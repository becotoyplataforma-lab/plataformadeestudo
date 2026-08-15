/**
 * ConcursoAI — QuestionGenerationProvider
 *
 * Abstração do provedor de geração de questões (DeepSeek), com interface
 * testável e instância concreta isolada (substituível sem alterar o domínio).
 */
import "server-only";
import { DeepSeekProvider } from "../services/deepseek-provider.service";
import type { AIModel } from "@/lib/ai/types";

export interface GeneratedQuestionInput {
  enunciado: string;
  alternativas: string[];
  gabarito: string;
  explicacao?: string;
  dificuldade?: string;
  topico?: string;
  fonte?: string;
}

export interface QuestionGenerationRequest {
  documentTitle: string;
  subjectName: string;
  quantity: number;
  nivel?: "facil" | "medio" | "dificil";
  banca?: string;
  cargo?: string;
  focusTopic?: string;
  context: string;
}

export interface QuestionGenerationProvider {
  isConfigured(): boolean;
  generateQuestions(req: QuestionGenerationRequest): Promise<GeneratedQuestionInput[]>;
}

export class QuestionGenerationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "QuestionGenerationError";
    this.code = code;
  }
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function extractJson(content: string): string {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new QuestionGenerationError("INVALID_RESPONSE", "Resposta da IA sem JSON válido.");
  }
  return content.slice(start, end + 1);
}

export const DeepSeekQuestionProvider: QuestionGenerationProvider = {
  isConfigured(): boolean {
    return Boolean(process.env.DEEPSEEK_API_KEY);
  },

  async generateQuestions(
    req: QuestionGenerationRequest
  ): Promise<GeneratedQuestionInput[]> {
    const prompt = buildPrompt(req);
    const result = await DeepSeekProvider.complete({
      model: "flash" as AIModel,
      messages: [
        { role: "system", content: "Você é um gerador de questões de concurso público." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 4096,
    });

    const parsed = JSON.parse(extractJson(stripCodeFences(result.content))) as {
      questions?: GeneratedQuestionInput[];
    };
    if (!Array.isArray(parsed.questions)) {
      throw new QuestionGenerationError(
        "INVALID_RESPONSE",
        "Resposta da IA sem a lista de questões."
      );
    }
    return parsed.questions;
  },
};

/** Instância concreta usada em produção. */
export const questionGenerationProvider: QuestionGenerationProvider =
  DeepSeekQuestionProvider;

function buildPrompt(req: QuestionGenerationRequest): string {
  const nivel = req.nivel ?? "medio";
  return [
    `Gere ${req.quantity} questões de múltipla escolha (A-E) baseadas ESTRITAMENTE no conteúdo da apostila.`,
    `Não invente informação fora da fonte. Se a fonte não cobrir o tema, não gere a questão.`,
    `Dificuldade alvo: ${nivel}.`,
    req.banca ? `Banca: ${req.banca}.` : "",
    req.cargo ? `Cargo: ${req.cargo}.` : "",
    req.focusTopic ? `Tema em foco (priorize questões sobre): ${req.focusTopic}.` : "",
    `Matéria: ${req.subjectName}. Documento: ${req.documentTitle}.`,
    `Responda SOMENTE com JSON no formato:`,
    `{"questions":[{"enunciado":"...","alternativas":["...","...","...","...","..."],"gabarito":"B","explicacao":"...","dificuldade":"${nivel}","topico":"..."}]}`,
    "",
    "CONTEÚDO DA APOSTILA (fonte):",
    req.context,
  ]
    .filter(Boolean)
    .join("\n");
}
