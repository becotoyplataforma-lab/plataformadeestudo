/**
 * ConcursoAI — EmbeddingClient
 *
 * Cliente HTTP para geração de embeddings via BAAI/bge-m3
 * (self-hosted ou API externa), conforme docs/10-EMBEDDING-STANDARD.md.
 *
 * - Dimensão oficial: 1024
 * - Provedor isolado em camada de integração (substituível sem alterar o domínio)
 * - OPENAI não é utilizado para embeddings
 *
 * Endpoint esperado: POST {EMBEDDING_API_URL}
 *
 * Suporta dois formatos:
 *  1) OpenAI-compatible (padrão Cloudflare Workers AI /v1/embeddings):
 *       Request:  { "model": "@cf/baai/bge-m3", "input": ["...", "..."] }
 *       Response: { "data": [{ "embedding": [...], "index": 0 }], "model": "...", "usage": {...} }
 *  2) Formato nativo ConcursoAI (self-hosted BAAI/bge-m3):
 *       Request:  { "texts": ["...", "..."], "model": "BAAI/bge-m3" }
 *       Response: { "embeddings": [[...], [...]], "model": "BAAI/bge-m3", "dimension": 1024 }
 *
 * O cliente envia o formato OpenAI-compatible e aceita ambos os formatos de
 * resposta, para ser compatível com Cloudflare Workers AI e self-hosted.
 */
import { env } from "@/lib/env";

const EMBEDDING_DIMENSION = env.EMBEDDING_DIMENSION;
const MODEL = env.EMBEDDING_MODEL;

export class EmbeddingClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingClientError";
  }
}

export interface EmbeddingClient {
  /** Gera vetor(es) de embedding para os textos. */
  embed(texts: string[]): Promise<number[][]>;
  /** Dimensão esperada do vetor. */
  readonly dimension: number;
  /** Modelo configurado. */
  readonly model: string;
  /** Indica se o serviço está configurado (env presente). */
  isConfigured(): boolean;
}

/**
 * Cliente HTTP real. Lança erro claro se EMBEDDING_API_URL não estiver
 * configurado — NÃO gera vetores falsos em produção.
 */
export const embeddingClient: EmbeddingClient = {
  dimension: EMBEDDING_DIMENSION,
  model: MODEL,

  isConfigured(): boolean {
    return Boolean(env.EMBEDDING_API_URL);
  },

  async embed(texts: string[]): Promise<number[][]> {
    const endpoint = env.EMBEDDING_API_URL;
    if (!endpoint) {
      throw new EmbeddingClientError(
        "Serviço de embeddings não configurado (EMBEDDING_API_URL ausente). " +
          "Configure o endpoint BAAI/bge-m3 para habilitar a busca vetorial."
      );
    }

    if (texts.length === 0) return [];

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (env.EMBEDDING_API_KEY) {
      headers["Authorization"] = `Bearer ${env.EMBEDDING_API_KEY}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: MODEL, input: texts }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new EmbeddingClientError(
        `Falha no serviço de embeddings: HTTP ${response.status}`
      );
    }

    const data = (await response.json()) as {
      // Formato OpenAI-compatible (Cloudflare Workers AI /v1/embeddings).
      data?: Array<{ embedding?: number[]; index?: number }>;
      // Formato nativo ConcursoAI (self-hosted BAAI/bge-m3).
      embeddings?: unknown;
      dimension?: number;
      model?: string;
    };

    let vectors: number[][];

    if (Array.isArray(data.data)) {
      // OpenAI-compatible: data[].embedding
      vectors = data.data.map((item) => item.embedding ?? []);
    } else if (Array.isArray(data.embeddings)) {
      // Nativo: embeddings: number[][]
      vectors = data.embeddings as number[][];
    } else {
      throw new EmbeddingClientError(
        "Resposta inválida do serviço de embeddings (esperado 'data[].embedding' " +
          "ou array 'embeddings')."
      );
    }

    if (vectors.length !== texts.length) {
      throw new EmbeddingClientError(
        "Resposta inválida do serviço de embeddings (número de vetores não " +
          "corresponde ao número de textos enviados)."
      );
    }

    for (const v of vectors) {
      if (!Array.isArray(v) || v.length !== EMBEDDING_DIMENSION) {
        throw new EmbeddingClientError(
          `Vetor de embedding com dimensão inválida (esperado ${EMBEDDING_DIMENSION}).`
        );
      }
    }

    return vectors;
  },
};
