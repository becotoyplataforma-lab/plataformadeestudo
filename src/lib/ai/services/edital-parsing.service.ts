/**
 * ConcursoAI — EditalParsingService
 *
 * Extrai a estrutura de um edital (banca, cargo, data, matérias com peso e tópicos estruturados)
 * a partir dos chunks do documento, via DeepSeek. O admin revisa e confirma
 * antes de aplicar em notice_subjects e notice_topics.
 */
import "server-only";
import { z } from "zod";
import { DeepSeekProvider } from "./deepseek-provider.service";
import type { AIModel } from "@/lib/ai/types";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentChunkRepository } from "@/lib/knowledge/repositories/chunk.repository";

export interface EditalTopicSuggestion {
  name: string;
  weight?: number;
  parent?: string;
}

export interface EditalMateriaSuggestion {
  name: string;
  weight: number;
  topicos?: EditalTopicSuggestion[];
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

export const RawEditalTopicSchema = z.object({
  name: z.string().min(1).max(300),
  weight: z.coerce.number().min(0).max(100).optional(),
  parent: z.string().min(1).max(300).optional(),
});

export const RawEditalMateriaSchema = z.object({
  name: z.string().min(1).max(200),
  weight: z.coerce.number().min(0).max(100).optional().default(0),
  topicos: z.array(RawEditalTopicSchema).optional().default([]),
});

export const RawEditalStructureSchema = z.object({
  banca: z.string().optional(),
  cargo: z.string().optional(),
  data_prova: z.string().optional(),
  materias: z.array(RawEditalMateriaSchema).optional().default([]),
});

export function extractJson(content: string): string {
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

export function parseEditalResponse(rawContent: string): EditalSuggestion {
  const jsonStr = extractJson(rawContent);
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(jsonStr);
  } catch {
    throw new EditalParsingError("INVALID_RESPONSE", "Resposta da IA sem JSON válido.");
  }

  const validation = RawEditalStructureSchema.safeParse(rawJson);
  if (!validation.success) {
    throw new EditalParsingError(
      "INVALID_RESPONSE",
      `Estrutura extraída inválida: ${validation.error.issues.map((i) => i.message).join(", ")}`
    );
  }

  const parsed = validation.data;

  const materias: EditalMateriaSuggestion[] = parsed.materias
    .filter((m) => m.name && m.name.trim().length > 0)
    .map((m) => {
      const topicos: EditalTopicSuggestion[] = (m.topicos ?? [])
        .filter((t) => t.name && t.name.trim().length > 0)
        .map((t) => ({
          name: t.name.trim(),
          weight:
            t.weight != null && !isNaN(t.weight)
              ? Math.max(0, Math.min(100, Math.round(t.weight * 100) / 100))
              : undefined,
          parent: t.parent?.trim() || undefined,
        }));

      return {
        name: m.name.trim(),
        weight: Math.max(0, Math.min(100, Math.round(m.weight ?? 0))),
        topicos: topicos.length > 0 ? topicos : undefined,
      };
    });

  return {
    banca: parsed.banca?.trim() || undefined,
    cargo: parsed.cargo?.trim() || undefined,
    dataProva: parsed.data_prova?.trim() || undefined,
    materias,
  };
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
      `Extraia do edital abaixo a estrutura completa do conteúdo programático:`,
      `- banca: banca organizadora (se informada)`,
      `- cargo: cargo(s) a que se refere o conteúdo (se informado)`,
      `- data_prova: data provável da prova (se informada)`,
      `- materias: lista de MATÉRIAS com seus PESOS (percentual ou nº de questões, ou 0 se não informado).`,
      `Para cada matéria, se o conteúdo programático contiver a discriminação dos TÓPICOS/ASSUNTOS, inclua a lista "topicos" com:`,
      `  - "name": nome do tópico/assunto conforme o edital`,
      `  - "weight": peso ou número de questões do tópico SE informado explicitamente no edital (caso contrário, omita)`,
      `  - "parent": nome do tópico-pai caso haja subtópicos hierárquicos explícitos (caso contrário, omita)`,
      `Se a matéria não detalhar tópicos, retorne "topicos": [].`,
      `Não invente dados nem distribua pesos da matéria automaticamente para os tópicos.`,
      ``,
      `Responda SOMENTE com JSON no seguinte formato:`,
      `{`,
      `  "banca": "...",`,
      `  "cargo": "...",`,
      `  "data_prova": "...",`,
      `  "materias": [`,
      `    {`,
      `      "name": "Língua Portuguesa",`,
      `      "weight": 20,`,
      `      "topicos": [`,
      `        { "name": "Compreensão e interpretação de textos" },`,
      `        { "name": "Ortografia oficial" },`,
      `        { "name": "Acentuação gráfica", "parent": "Ortografia oficial" }`,
      `      ]`,
      `    }`,
      `  ]`,
      `}`,
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

    return parseEditalResponse(result.content);
  },
};
