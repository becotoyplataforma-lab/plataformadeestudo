/**
 * ConcursoAI — EditalParsingService
 *
 * Extrai a estrutura de um edital (banca, cargo, data, matérias com peso)
 * a partir dos chunks do documento, via DeepSeek. O admin revisa e confirma
 * antes de aplicar em notice_subjects.
 */
import "server-only";
import { DeepSeekProvider } from "./deepseek-provider.service";
import type { AIModel } from "@/lib/ai/types";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentChunkRepository } from "@/lib/knowledge/repositories/chunk.repository";

export interface EditalMateriaSuggestion {
  name: string;
  weight: number;
}

export interface EditalSuggestion {
  banca?: string;
  cargo?: string;
  dataProva?: string;
  materias: EditalMateriaSuggestion[];
}

export class EditalParsingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EditalParsingError";
    this.code = code;
  }
}

function extractJson(content: string): string {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new EditalParsingError("INVALID_RESPONSE", "Resposta da IA sem JSON válido.");
  }
  return content
    .slice(start, end + 1)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

export const EditalParsingService = {
  async parseFromDocument(documentId: string): Promise<EditalSuggestion> {
    const doc = await DocumentRepository.findById(documentId);
    if (!doc) throw new EditalParsingError("DOC_NOT_FOUND", "Documento não encontrado.");
    if (doc.status !== "chunked" && doc.status !== "indexed") {
      throw new EditalParsingError(
        "DOC_NOT_READY",
        `Documento em estado ${doc.status}; processe antes de analisar o edital.`
      );
    }

    const chunks = await DocumentChunkRepository.listByDocument(documentId);
    if (chunks.length === 0) throw new EditalParsingError("NO_CHUNKS", "Documento sem chunks.");
    const context = chunks.map((c) => c.content ?? "").join("\n\n").slice(0, 16000);

    const prompt = [
      `Você é um especialista em editais de concursos públicos.`,
      `Extraia do edital abaixo a estrutura: banca organizadora, cargo(s), data provável da prova e a lista de MATÉRIAS com seus PESOS (percentual ou nº de questões quando informado).`,
      `Se um dado não estiver no edital, omita o campo. Não invente.`,
      `Responda SOMENTE com JSON no formato:`,
      `{"banca":"...","cargo":"...","data_prova":"...","materias":[{"name":"Português","weight":20}, ...]}`,
      ``,
      `CONTEÚDO DO EDITAL:`,
      context,
    ].join("\n");

    const result = await DeepSeekProvider.complete({
      model: "pro" as AIModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      maxTokens: 4000,
    });

    const parsed = JSON.parse(extractJson(result.content)) as {
      banca?: string;
      cargo?: string;
      data_prova?: string;
      materias?: { name?: string; weight?: number }[];
    };

    const materias = (parsed.materias ?? [])
      .filter((m) => m.name && m.name.trim().length > 0)
      .map((m) => ({
        name: m.name!.trim(),
        weight: Math.max(0, Math.min(100, Math.round(m.weight ?? 0))),
      }));

    return {
      banca: parsed.banca?.trim() || undefined,
      cargo: parsed.cargo?.trim() || undefined,
      dataProva: parsed.data_prova?.trim() || undefined,
      materias,
    };
  },
};
