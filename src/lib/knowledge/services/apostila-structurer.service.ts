/**
 * ConcursoAI — estruturação em fases (offline determinístico + porta de IA)
 *
 * Dois caminhos, uma regra:
 *  - `normalizeOffline` reusa `normalizeStructure` do provedor MCP. Nenhuma
 *    linha é apagada, nenhuma palavra é reescrita: promove `Fase 01 - Tema` a
 *    cabeçalho Markdown e remarca caixas REGRA/ATENÇÃO/DICA/CUIDADO. Idempotente,
 *    então reprocessar o mesmo documento não acumula marcação.
 *  - `structureWithLlm` existe para os modos `structure`/`full` e é **gateada**:
 *    a saída só é aceita se conservar as questões comentadas e as marcas de
 *    procedência da entrada. IA que reorganiza e apaga `Estratégia` do material
 *    que tinha `Estratégia` não é edição, é ocultação de titularidade, e o
 *    `AGENTS.md` (43-45) não deixa isso passar pela porta da indexação.
 *
 * Não há expansão de conteúdo aqui: "expandir com exemplos" contraria a regra de
 * que a IA nunca inventa conteúdo (ver `apostila-transform.service.ts`, 16-17).
 */
import "server-only";
import {
  ADAPTATION_BANNER,
  ADAPTATION_MARKER,
  RIGHTS_FOOTER,
  RIGHTS_MARKER,
  normalizeStructure,
} from "../mcp/providers/apostila-mcp";
import { accentInsensitiveSource } from "./apostila-sanitizer.service";
import { prompts, interpolate } from "@/lib/ai/prompts";
import { logger } from "@/lib/observability";
import {
  ApostilaTransformError,
  type ApostilaStructuringClient,
  type ApostilaTransformMode,
} from "../dto/apostila-transform.dto";
import type { ApostilaRules } from "../config/apostila-rules.schema";

/** Limite duro de texto levado à IA: o resto seria cortado no meio de uma questão. */
const HARD_LLM_LIMIT_CHARS = 60000;

/** Comparação sem acento: o vocabulário do arquivo de regras é escrito sem acentos. */
function foldAccents(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** `Questão 12`, `Exercício 7`, `Questões 1 a 10`: contagem comparável entre entrada e saída. */
export function countQuestions(text: string, rules: ApostilaRules): number {
  // accentInsensitiveSource: o arquivo lista "questao" sem acento, o material real
  // escreve "Questão". Comparar literal cru diria que a entrada nao tem questoes,
  // e o portao de qualidade nunca dispararia.
  const pattern = new RegExp(
    "\\b(?:" + rules.marcadores_questao.map(accentInsensitiveSource).join("|") + ")\\s*(?:n?o?\\.?\\s*)?\\d{1,3}\\b",
    "gi",
  );
  return (text.match(pattern) ?? []).length;
}

/**
 * Tokens de procedência presentes no texto. A checagem é de presença, não de
 * contagem: a IA pode citar a plataforma uma vez em vez de doze, e isso não é
 * apagar autoria. O que não pode é sumir.
 */
export function detectProvenanceTokens(text: string, rules: ApostilaRules): string[] {
  const folded = foldAccents(text);
  const found: string[] = [];
  for (const token of rules.marcas_procedencia) {
    const needle = foldAccents(token.toLowerCase());
    if (needle.length > 0 && folded.includes(needle)) found.push(token);
  }
  if (/https?:\/\//i.test(text) || /www\./i.test(text)) found.push("url");
  if (folded.includes(foldAccents(RIGHTS_MARKER))) found.push("aviso_de_direitos");
  return found;
}

export function missingProvenance(input: {
  before: string[];
  after: string;
}): string[] {
  const folded = foldAccents(input.after);
  return input.before.filter((token) => {
    if (token === "url") return !/https?:\/\//i.test(input.after) && !/www\./i.test(input.after);
    if (token === "aviso_de_direitos") return !folded.includes(foldAccents(RIGHTS_MARKER));
    return !folded.includes(foldAccents(token.toLowerCase()));
  });
}

/** A IA costuma devolver ```markdown ... ```; o fence não é conteúdo. */
function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  const fence = /^```(?:markdown|md|html)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/.exec(trimmed);
  if (fence?.[1]) return fence[1];
  return trimmed.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/, "");
}

export interface OfflineStructure {
  text: string;
  headings: number;
  boxes: number;
}

export const ApostilaStructurerService = {
  /**
   * Normalização estrutural que roda sempre, com ou sem IA. Não insere aviso de
   * adaptação: no caminho offline o texto não foi adaptado por ninguém, e banner
   * de IA sem IA é procedência falsa.
   */
  normalizeOffline(text: string, rules: ApostilaRules): OfflineStructure {
    if (!rules.estrutura) return { text, headings: 0, boxes: 0 };
    const unified = text.replace(/\r\n?/g, "\n");
    const structured = normalizeStructure(unified);
    const collapsed = structured.text.replace(/\n{3,}/g, "\n\n");
    return { text: collapsed, headings: structured.headings, boxes: structured.boxes };
  },

  /**
   * Avisos de adaptação por IA e de direitos do autor original. Chamado só
   * depois de uma passagem de IA aceita, ou seja, quando a adaptação existiu.
   */
  withProvenanceNotices(text: string): string {
    let out = text;
    if (!out.includes(ADAPTATION_MARKER)) out = ADAPTATION_BANNER.join("\n") + "\n\n" + out;
    if (!out.includes(RIGHTS_MARKER)) out = out + "\n\n" + RIGHTS_FOOTER.join("\n");
    return out;
  },

  /**
   * Passagem de IA com portão de qualidade. Qualquer reprovação lança
   * `ApostilaTransformError` e o orquestrador cai para `sanitize-only`: o upload
   * nunca falha por capricho do modelo, e nunca indexa texto que apagou autoria.
   */
  async structureWithLlm(input: {
    text: string;
    rules: ApostilaRules;
    mode: ApostilaTransformMode;
    client: ApostilaStructuringClient;
    fileName?: string;
  }): Promise<{ text: string; model: string; headings: number; boxes: number }> {
    if (!input.client.available) {
      throw new ApostilaTransformError("LLM_UNAVAILABLE", "Nenhum provedor de IA configurado.");
    }

    const limit = Math.min(input.rules.llm_max_chars, HARD_LLM_LIMIT_CHARS);
    const template = await prompts.apostilaEstruturarFases();
    const prompt = interpolate(template, {
      modo: input.mode,
      apostila_arquivo: input.fileName ?? "apostila",
      apostila_conteudo: input.text.slice(0, limit),
    });

    const questionsBefore = countQuestions(input.text, input.rules);
    const provenanceBefore = detectProvenanceTokens(input.text, input.rules);

    const completion = await input.client.structure({ prompt, maxChars: limit });
    const cleaned = stripCodeFence(completion.text).trim();

    if (cleaned.length < 200) {
      throw new ApostilaTransformError(
        "LLM_EMPTY_RESPONSE",
        "A IA devolveu resposta demasiado curta para ser um documento.",
      );
    }

    const questionsAfter = countQuestions(cleaned, input.rules);
    if (questionsAfter < questionsBefore) {
      logger.warn("apostila-structurer", "IA perdeu questoes comentadas; saida rejeitada", {
        questionsBefore,
        questionsAfter,
      });
      throw new ApostilaTransformError(
        "LLM_QUESTIONS_LOST",
        "A IA devolveu menos questoes comentadas do que a entrada (" +
          questionsAfter +
          " de " +
          questionsBefore +
          ").",
      );
    }

    const missing = missingProvenance({ before: provenanceBefore, after: cleaned });
    if (missing.length > 0) {
      logger.warn("apostila-structurer", "IA removeu procedencia; saida rejeitada", { missing });
      throw new ApostilaTransformError(
        "LLM_PROVENANCE_LOST",
        "A IA removeu identificacao de origem: " + missing.join(", ") + ".",
      );
    }

    const structured = ApostilaStructurerService.normalizeOffline(cleaned, input.rules);
    return {
      text: ApostilaStructurerService.withProvenanceNotices(structured.text),
      model: completion.model,
      headings: structured.headings,
      boxes: structured.boxes,
    };
  },
};

