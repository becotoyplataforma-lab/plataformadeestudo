/**
 * ConcursoAI — FlashcardGenerationProvider
 *
 * Abstração do provedor de geração de flashcards (DeepSeek).
 */
import "server-only";
import { DeepSeekProvider } from "../services/deepseek-provider.service";
import type { AIModel } from "@/lib/ai/types";

export interface GeneratedFlashcard {
  front: string;
  back: string;
}

export interface FlashcardGenerationRequest {
  documentTitle: string;
  subjectName: string;
  quantity: number;
  context: string;
}

export interface FlashcardGenerationProvider {
  isConfigured(): boolean;
  generateFlashcards(req: FlashcardGenerationRequest): Promise<GeneratedFlashcard[]>;
}

export class FlashcardGenerationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FlashcardGenerationError";
    this.code = code;
  }
}

function extractJson(content: string): string {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new FlashcardGenerationError("INVALID_RESPONSE", "Resposta da IA sem JSON válido.");
  }
  return content
    .slice(start, end + 1)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

export const DeepSeekFlashcardProvider: FlashcardGenerationProvider = {
  isConfigured(): boolean {
    return Boolean(process.env.DEEPSEEK_API_KEY);
  },

  async generateFlashcards(
    req: FlashcardGenerationRequest
  ): Promise<GeneratedFlashcard[]> {
    const prompt = [
      `Gere ${req.quantity} flashcards (frente/verso) para memorização, baseados ESTRITAMENTE no conteúdo da apostila.`,
      `Não invente informação fora da fonte. Frente = pergunta/termo/conceito curto; verso = resposta/definição objetiva.`,
      `Matéria: ${req.subjectName}. Documento: ${req.documentTitle}.`,
      `Responda SOMENTE com JSON no formato:`,
      `{"flashcards":[{"front":"...","back":"..."}]}`,
      "",
      "CONTEÚDO DA APOSTILA (fonte):",
      req.context,
    ].join("\n");

    const result = await DeepSeekProvider.complete({
      model: "flash" as AIModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      maxTokens: 3000,
    });

    const parsed = JSON.parse(extractJson(result.content)) as {
      flashcards?: GeneratedFlashcard[];
    };
    if (!Array.isArray(parsed.flashcards)) {
      throw new FlashcardGenerationError(
        "INVALID_RESPONSE",
        "Resposta da IA sem a lista de flashcards."
      );
    }
    return parsed.flashcards;
  },
};

export const flashcardGenerationProvider: FlashcardGenerationProvider =
  DeepSeekFlashcardProvider;
