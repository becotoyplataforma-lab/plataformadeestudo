/**
 * ConcursoAI — EmbeddingService
 *
 * Gera vetores de embedding (1024d) via BAAI/bge-m3 para cada chunk,
 * com cache por content_hash e armazenamento em pgvector.
 *
 * Segue: .ai/blueprints/04-embedding.blueprint.md
 */
import { DocumentRepository } from "../repositories/document.repository";
import { DocumentChunkRepository } from "../repositories/chunk.repository";
import { EmbeddingRepository } from "../repositories/embedding.repository";
import { EmbeddingCacheRepository } from "../repositories/embedding-cache.repository";
import { embeddings as embeddingsTable } from "@/db/schema/knowledge";
import { embeddingClient, EmbeddingClientError } from "../embedding/client";

// ============================================================
// Tipos
// ============================================================

export interface EmbeddingInput {
  documentId: string;
  model?: string;
}

export interface EmbeddingResult {
  chunkId: string;
  embeddingId: string | null;
  fromCache: boolean;
  status: "success" | "failed";
  error?: string;
}

export interface EmbeddingOutput {
  documentId: string;
  results: EmbeddingResult[];
  cachedCount: number;
  generatedCount: number;
  failedCount: number;
  model: string;
}

// ============================================================
// Constantes
// ============================================================

const DEFAULT_MODEL = embeddingClient.model;
const BATCH_SIZE = 20;

// ============================================================
// Service
// ============================================================

export const EmbeddingService = {
  /**
   * Orquestrar embedding de todos os chunks pendentes de um documento.
   */
  async embedDocument(input: EmbeddingInput): Promise<EmbeddingOutput> {
    const { documentId, model = DEFAULT_MODEL } = input;

    if (!embeddingClient.isConfigured()) {
      // Não bloqueia o documento: registra o estado para retry quando configurar.
      await DocumentRepository.updateStatus(documentId, "indexed");
      throw new EmbeddingClientError(
        "Serviço de embeddings não configurado (EMBEDDING_API_URL ausente)."
      );
    }

    // 1. Obter chunks pendentes
    const allChunks = await DocumentChunkRepository.getPendingChunks(documentId);

    // 2. Filtrar chunks que já têm embedding
    const existingEmbeddings = await EmbeddingRepository.findByChunkIds(
      allChunks.map((c) => c.id)
    );
    const existingIds = new Set(existingEmbeddings.map((e) => e.chunkId));

    const pendingChunks = allChunks.filter((c) => !existingIds.has(c.id));

    if (pendingChunks.length === 0) {
      await DocumentRepository.updateStatus(documentId, "indexed");
      return {
        documentId,
        results: [],
        cachedCount: existingIds.size,
        generatedCount: 0,
        failedCount: 0,
        model,
      };
    }

    // 3. Atualizar status
    await DocumentRepository.updateStatus(documentId, "indexing");

    const results: EmbeddingResult[] = [];
    let cachedCount = existingIds.size;
    let generatedCount = 0;
    let failedCount = 0;

    // 4. Processar em lotes
    for (let i = 0; i < pendingChunks.length; i += BATCH_SIZE) {
      const batch = pendingChunks.slice(i, i + BATCH_SIZE);
      const batchResults: (typeof embeddingsTable.$inferInsert)[] = [];

      // Separar chunks que podem ser servidos do cache
      const toEmbed: { chunkId: string; content: string; hash?: string | null }[] = [];
      const cacheHits: Map<string, number[]> = new Map();

      for (const chunk of batch) {
        const hash = chunk.contentHash;
        if (hash) {
          const cached = await EmbeddingCacheRepository.get(hash, model);
          if (cached) {
            cacheHits.set(chunk.id, cached.embedding);
            cachedCount++;
            continue;
          }
        }
        toEmbed.push({ chunkId: chunk.id, content: chunk.content ?? "", hash });
      }

      // 4b. Gerar embeddings em batch via cliente real
      if (toEmbed.length > 0) {
        try {
          const vectors = await embeddingClient.embed(toEmbed.map((t) => t.content));
          for (let j = 0; j < toEmbed.length; j++) {
            const item = toEmbed[j];
            if (item.hash) {
              await EmbeddingCacheRepository.set(item.hash, model, vectors[j]);
            }
            batchResults.push({
              chunkId: item.chunkId,
              model,
              embedding: vectors[j],
            });
            results.push({
              chunkId: item.chunkId,
              embeddingId: null,
              fromCache: false,
              status: "success",
            });
            generatedCount++;
          }
        } catch (err) {
          for (const item of toEmbed) {
            results.push({
              chunkId: item.chunkId,
              embeddingId: null,
              fromCache: false,
              status: "failed",
              error: err instanceof Error ? err.message : "Embedding generation failed",
            });
            failedCount++;
          }
        }
      }

      // 4c. Processar cache hits
      for (const [chunkId, vector] of cacheHits) {
        batchResults.push({ chunkId, model, embedding: vector });
        results.push({
          chunkId,
          embeddingId: null,
          fromCache: true,
          status: "success",
        });
      }

      // 5. Inserir batch
      if (batchResults.length > 0) {
        const inserted = await EmbeddingRepository.createBatch(batchResults);
        // Atualizar IDs nos resultados
        for (const emb of inserted) {
          const idx = results.findIndex((r) => r.chunkId === emb.chunkId && !r.embeddingId);
          if (idx >= 0 && results[idx].status === "success") {
            results[idx].embeddingId = emb.id;
          }
        }
      }
    }

    // 6. Atualizar status final
    await DocumentRepository.updateStatus(documentId, "indexed");

    return {
      documentId,
      results,
      cachedCount,
      generatedCount,
      failedCount,
      model,
    };
  },
};
