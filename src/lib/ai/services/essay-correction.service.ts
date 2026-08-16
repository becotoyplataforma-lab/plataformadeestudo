/**
 * ConcursoAI — EssayCorrectionService (FASE 5 — correção de redação)
 *
 * Avalia uma redação dissertativa-argumentativa com critérios genéricos
 * (modelo ENEM como referência): coerência, coesão, norma culta, argumentação
 * e proposta de intervenção. Retorna nota estimada (0–1000) + feedback por
 * critério. Usa o DeepSeek (modelo "pro").
 */
import "server-only";
import { DeepSeekProvider } from "./deepseek-provider.service";
import type { AIModel } from "@/lib/ai/types";

export class EssayCorrectionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EssayCorrectionError";
    this.code = code;
  }
}

export interface EssayCriterion {
  nome: string;
  nota: number; // 0–200
  comentario: string;
}

export interface EssayCorrectionResult {
  notaTotal: number; // 0–1000
  criterios: EssayCriterion[];
  comentarioGeral: string;
}

const MIN_CHARS = 120;

function stripCodeFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function extractJson(content: string): string {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new EssayCorrectionError("INVALID_RESPONSE", "Resposta da IA sem JSON válido.");
  }
  return content.slice(start, end + 1);
}

function validateResult(raw: unknown): EssayCorrectionResult {
  const obj = raw as Record<string, unknown>;
  const criterios = Array.isArray(obj.criterios)
    ? (obj.criterios as unknown[]).map((c) => {
        const item = c as Record<string, unknown>;
        return {
          nome: String(item.nome ?? "Critério"),
          nota: Math.max(0, Math.min(200, Number(item.nota) || 0)),
          comentario: String(item.comentario ?? ""),
        };
      })
    : [];
  if (criterios.length === 0) {
    throw new EssayCorrectionError("INVALID_RESPONSE", "IA não retornou critérios de correção.");
  }
  const notaTotal = Number(obj.nota_total) || criterios.reduce((a, c) => a + c.nota, 0);
  return {
    notaTotal: Math.max(0, Math.min(1000, notaTotal)),
    criterios,
    comentarioGeral: String(obj.comentario_geral ?? ""),
  };
}

export const EssayCorrectionService = {
  isConfigured(): boolean {
    return Boolean(process.env.DEEPSEEK_API_KEY);
  },

  async correct(
    text: string
  ): Promise<{ data: EssayCorrectionResult; tokensIn: number; tokensOut: number }> {
    if (!this.isConfigured()) {
      throw new EssayCorrectionError("AI_NOT_CONFIGURED", "O serviço de IA não está configurado.");
    }
    if (text.trim().length < MIN_CHARS) {
      throw new EssayCorrectionError(
        "TEXT_TOO_SHORT",
        `Envie um texto com pelo menos ${MIN_CHARS} caracteres.`
      );
    }

    const prompt = [
      "Avalie a redação dissertativa-argumentativa abaixo (critérios estilo ENEM).",
      "Atribua nota 0–200 a cada critério e a nota total 0–1000.",
      "Critérios: Coerência, Coesão, Norma culta, Argumentação, Proposta de intervenção.",
      'Responda SOMENTE com JSON no formato:',
      '{"nota_total": 0, "criterios": [{"nome": "Coerência", "nota": 0, "comentario": "..."}], "comentario_geral": "..."}',
      "",
      "REDAÇÃO:",
      text.trim(),
    ].join("\n");

    const result = await DeepSeekProvider.complete({
      model: "pro" as AIModel,
      messages: [
        {
          role: "system",
          content:
            "Você é um corretor de redações de concursos públicos, objetivo e construtivo.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 2048,
    });

    const data = validateResult(JSON.parse(extractJson(stripCodeFences(result.content))));
    return { data, tokensIn: result.tokensIn, tokensOut: result.tokensOut };
  },
};
