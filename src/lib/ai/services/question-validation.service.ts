/**
 * ConcursoAI — QuestionValidationService
 *
 * Validação automática de questões geradas por IA (pré-publicação).
 * Função pura, testável, sem dependência de IA.
 *
 * Regras (FASE 11): 5 alternativas, uma correta, gabarito consistente,
 * explicação, conteúdo não vazio, dificuldade válida, não duplicada,
 * sem contradição, rastreabilidade (fonte).
 */
import type { GeneratedQuestionInput } from "../generation/question-generation.provider";

export interface ValidationIssue {
  rule: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  score: number; // 0..1 (confiança da IA)
  issues: ValidationIssue[];
}

const VALID_DIFFICULTY = new Set(["facil", "medio", "dificil"]);
const VALID_LETTERS = ["A", "B", "C", "D", "E"];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9áàâãéêíóôõúüç\s]/g, " ").replace(/\s+/g, " ").trim();
}

export const QuestionValidationService = {
  validate(
    q: GeneratedQuestionInput,
    options: { context?: string; existingEnunciados?: Set<string> } = {}
  ): ValidationResult {
    const issues: ValidationIssue[] = [];
    const alternatives = (q.alternativas ?? []).map((a) => (a ?? "").trim());

    // 1. Exatamente 5 alternativas
    if (alternatives.length !== 5) {
      issues.push({
        rule: "EXACTLY_5_ALTERNATIVES",
        message: `Esperado 5 alternativas; recebido ${alternatives.length}.`,
      });
    }

    // 2. Nenhuma alternativa vazia
    if (alternatives.some((a) => a.length === 0)) {
      issues.push({ rule: "NO_EMPTY_ALTERNATIVE", message: "Alternativa vazia." });
    }

    // 3. Gabarito válido
    const gabarito = (q.gabarito ?? "").trim().toUpperCase();
    if (!VALID_LETTERS.includes(gabarito)) {
      issues.push({ rule: "VALID_GABARITO", message: "Gabarito inválido." });
    }

    // 4. Enunciado não vazio
    if (!q.enunciado || q.enunciado.trim().length < 10) {
      issues.push({ rule: "NON_EMPTY_STATEMENT", message: "Enunciado vazio ou curto demais." });
    }

    // 5. Explicação presente e consistente (heurística de tamanho)
    if (!q.explicacao || q.explicacao.trim().length < 10) {
      issues.push({ rule: "EXPLANATION_REQUIRED", message: "Explicação ausente ou curta demais." });
    }

    // 6. Dificuldade válida
    const dificuldade = (q.dificuldade ?? "medio").trim().toLowerCase();
    if (!VALID_DIFFICULTY.has(dificuldade)) {
      issues.push({ rule: "VALID_DIFFICULTY", message: `Dificuldade inválida: ${dificuldade}.` });
    }

    // 7. Gabarito corresponde à alternativa (letra existente na posição)
    if (gabarito.length === 1 && alternatives.length === 5) {
      const idx = VALID_LETTERS.indexOf(gabarito);
      if (idx >= 0 && alternatives[idx].length === 0) {
        issues.push({ rule: "GABARITO_MATCHES", message: "Gabarito aponta para alternativa vazia." });
      }
    }

    // 8. Duplicidade (enunciado normalizado repetido)
    const normEnunciado = normalize(q.enunciado ?? "");
    if (options.existingEnunciados?.has(normEnunciado)) {
      issues.push({ rule: "NOT_DUPLICATED", message: "Questão duplicada." });
    }

    // 9. Relação com o conteúdo (sobreposição mínima de termos)
    if (options.context && normEnunciado) {
      const contextWords = new Set(normalize(options.context).split(" ").filter((w) => w.length > 3));
      const statementWords = normEnunciado.split(" ").filter((w) => w.length > 3);
      const overlap = statementWords.filter((w) => contextWords.has(w)).length;
      if (overlap === 0) {
        issues.push({ rule: "RELATED_TO_CONTENT", message: "Questão sem relação aparente com o conteúdo." });
      }
    }

    // 10. Sem contradição óbvia (alternativas duplicadas)
    const uniqueAlts = new Set(alternatives.map(normalize));
    if (uniqueAlts.size !== alternatives.length) {
      issues.push({ rule: "NO_CONTRADICTION", message: "Alternativas repetidas." });
    }

    const score = Math.max(0, 1 - issues.length * 0.12);
    return {
      valid: issues.length === 0,
      score: Math.round(score * 100) / 100,
      issues,
    };
  },
};
