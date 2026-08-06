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
 *   Request:  { "texts": ["...", "..."], "model": "BAAI/bge-m3" }
 *   Response: { "embeddings": [[...], [...]], "model": "BAAI/bge-m3", "dimension": 1024 }
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
      body: JSON.stringify({ texts, model: MODEL }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new EmbeddingClientError(
        `Falha no serviço de embeddings: HTTP ${response.status}`
      );
    }

    const data = (await response.json()) as {
      embeddings?: unknown;
      dimension?: number;
      model?: string;
    };

    if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length) {
      throw new EmbeddingClientError(
        "Resposta inválida do serviço de embeddings (esperado array 'embeddings')."
      );
    }

    const vectors = data.embeddings as number[][];
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
