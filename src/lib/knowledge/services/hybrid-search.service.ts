/**
 * ConcursoAI — HybridSearchService
 *
 * Busca combinada (vetorial + Full Text Search) sobre documentos do usuário.
 *
 * Segue: .ai/blueprints/05-hybrid-search.blueprint.md
 */
import { and, eq, isNull, sql, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import {
  documents,
  documentChunks,
  documentSubjects,
  knowledgeSubjects,
  embeddings,
} from "@/db/schema/knowledge";
import { embeddingClient } from "../embedding/client";

// ============================================================
// Tipos
// ============================================================

export interface SearchFilters {
  subjectId?: string;
  topicId?: string;
  documentId?: string;
  tagIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  /**
   * Isolamento por curso/cargo: quando presente, restringe a busca a documentos
   * vinculados a este cargo (documents.position_id). Resolvido no backend a
   * partir do perfil autenticado — nunca aceito do cliente como autoridade.
   */
  positionId?: string;
  /**
   * Isolamento por edital: quando presente, restringe a busca a documentos
   * vinculados a este edital (documents.edital_id). Usado como fallback quando
   * o aluno não tem cargo selecionado (edital vigente do concurso).
   */
  editalId?: string;
}

export interface SearchInput {
  query: string;
  userId: string;
  filters?: SearchFilters;
  topK?: number;
  vectorWeight?: number;
  ftsWeight?: number;
}

export interface SearchResultItem {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
  vectorScore: number;
  ftsScore: number;
  page?: number;
  sectionTitle?: string;
  subjectName?: string;
}

export interface SearchOutput {
  results: SearchResultItem[];
  totalHits: number;
  queryTimeMs: number;
  /** Indica se a busca vetorial (pgvector) foi usada nesta consulta. */
  vectorSearchEnabled: boolean;
}

// ============================================================
// Constantes
// ============================================================

/**
 * Status de documento considerados "prontos para busca textual".
 *
 * O pipeline sem embeddings (EMBEDDING_API_URL ausente) termina em `chunked`
 * (texto extraído + chunks + fts_vector prontos) — NÃO é falha. Com embeddings
 * configurados, o status é `indexed`. Ambos são pesquisáveis via FTS.
 *
 * `pending`/`processing`/`processed`/`indexing` = ainda não finalizados.
 * `failed` = erro no processamento (texto vazio, OCR ausente etc.).
 */
export const SEARCHABLE_DOCUMENT_STATUSES = ["chunked", "indexed"] as const;

// ============================================================
// Service
// ============================================================

export const HybridSearchService = {
  /**
   * Orquestrar busca híbrida.
   */
  async search(input: SearchInput): Promise<SearchOutput> {
    const {
      query,
      userId,
      filters = {},
      topK = 10,
      vectorWeight = 0.7,
      ftsWeight = 0.3,
    } = input;

    const startedAt = Date.now();

    // Validação
    if (!query || query.trim().length === 0) {
      return { results: [], totalHits: 0, queryTimeMs: 0, vectorSearchEnabled: false };
    }

    // 1. Obter IDs de documentos do usuário (status prontos para busca textual:
    //    `chunked` quando não há embeddings configurados, `indexed` quando há)
    const userDocs = await db
      .select({ id: documents.id, title: documents.title })
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          isNull(documents.deletedAt),
          inArray(documents.status, [...SEARCHABLE_DOCUMENT_STATUSES]),
          // Isolamento por curso/cargo/edital (resolvido no backend via perfil).
          ...(filters.positionId
            ? [eq(documents.positionId, filters.positionId)]
            : []),
          ...(filters.editalId ? [eq(documents.editalId, filters.editalId)] : [])
        )
      );

    const userDocIds = userDocs.map((d) => d.id);
    if (userDocIds.length === 0) {
      return { results: [], totalHits: 0, queryTimeMs: Date.now() - startedAt, vectorSearchEnabled: false };
    }

    // Aplicar filtros
    let filteredDocIds = userDocIds;

    if (filters.subjectId) {
      const subjectDocs = await db
        .select({ documentId: documentSubjects.documentId })
        .from(documentSubjects)
        .where(eq(documentSubjects.subjectId, filters.subjectId));
      const subjectDocIds = new Set(subjectDocs.map((s) => s.documentId));
      filteredDocIds = filteredDocIds.filter((id) => subjectDocIds.has(id));
    }

    if (filters.documentId) {
      filteredDocIds = filteredDocIds.filter((id) => id === filters.documentId);
    }

    if (filteredDocIds.length === 0) {
      return { results: [], totalHits: 0, queryTimeMs: Date.now() - startedAt, vectorSearchEnabled: false };
    }

    // 2. Busca FTS (Full Text Search)
    // Sanitiza pontuação; OR de prefixos via to_tsquery (remove stopwords e
    // mantém o prefixo '*'), ranqueado por ts_rank. Robusto a entrada do usuário.
    const ftsQuery = query
      .toLowerCase()
      .replace(/[^a-z0-9\sà-ÿ]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => w + ":*")
      .join(" | ");

    if (!ftsQuery) {
      return { results: [], totalHits: 0, queryTimeMs: Date.now() - startedAt, vectorSearchEnabled: false };
    }

    const ftsSearch = sql`to_tsquery('portuguese', ${ftsQuery})`;
    const ftsRank = sql<number>`ts_rank(${documentChunks.ftsVector}, ${ftsSearch})`;

    const ftsResults = await db
      .select({
        chunkId: documentChunks.id,
        documentId: documentChunks.documentId,
        score: ftsRank,
      })
      .from(documentChunks)
      .where(
        and(
          inArray(documentChunks.documentId, filteredDocIds),
          isNull(documentChunks.deletedAt),
          sql`${documentChunks.ftsVector} @@ ${ftsSearch}`
        )
      )
      .orderBy(desc(ftsRank))
      .limit(20);

    // 3. Busca vetorial (pgvector) — quando embeddings existem para os documentos.
    //    Se EMBEDDING_API_URL não estiver configurado OU não houver embeddings
    //    para os documentos do usuário, cai automaticamente para FTS-only.
    let vectorResults: { chunkId: string; documentId: string; score: number }[] = [];
    let vectorSearchEnabled = false;

    if (embeddingClient.isConfigured()) {
      try {
        // Verifica se há embeddings para os documentos filtrados.
        const [hasEmbeddings] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(embeddings)
          .innerJoin(
            documentChunks,
            eq(embeddings.chunkId, documentChunks.id)
          )
          .where(
            and(
              inArray(documentChunks.documentId, filteredDocIds),
              isNull(documentChunks.deletedAt)
            )
          )
          .limit(1);

        if ((hasEmbeddings?.count ?? 0) > 0) {
          // Embeda a query e busca por similaridade de cosseno (<=>).
          const [queryVector] = await embeddingClient.embed([query]);
          if (queryVector) {
            vectorSearchEnabled = true;
            const vectorLiteral = sql`${queryVector}::vector`;
            const cosineDist = sql<number>`1 - (${embeddings.embedding} <=> ${vectorLiteral})`;

            vectorResults = await db
              .select({
                chunkId: embeddings.chunkId,
                documentId: documentChunks.documentId,
                score: cosineDist,
              })
              .from(embeddings)
              .innerJoin(
                documentChunks,
                eq(embeddings.chunkId, documentChunks.id)
              )
              .where(
                and(
                  inArray(documentChunks.documentId, filteredDocIds),
                  isNull(documentChunks.deletedAt)
                )
              )
              .orderBy(desc(cosineDist))
              .limit(20);
          }
        }
      } catch (error) {
        // Falha na busca vetorial (ex.: serviço de embeddings indisponível)
        // não deve quebrar a busca — cai para FTS-only.
        console.warn("[hybrid-search] Busca vetorial indisponível, usando FTS:", error);
        vectorSearchEnabled = false;
      }
    }

    // 4. Combinar resultados (vetorial + FTS)
    const combined = new Map<string, {
      chunkId: string;
      documentId: string;
      ftsScore: number;
      vectorScore: number;
    }>();

    for (const r of ftsResults) {
      combined.set(r.chunkId, {
        chunkId: r.chunkId,
        documentId: r.documentId,
        ftsScore: r.score,
        vectorScore: 0,
      });
    }

    for (const r of vectorResults) {
      const existing = combined.get(r.chunkId);
      if (existing) {
        existing.vectorScore = r.score;
      } else {
        combined.set(r.chunkId, {
          chunkId: r.chunkId,
          documentId: r.documentId,
          ftsScore: 0,
          vectorScore: r.score,
        });
      }
    }

    // 5. Construir resultados
    const sorted = Array.from(combined.values())
      .map((c) => ({
        ...c,
        hybridScore: c.vectorScore * vectorWeight + c.ftsScore * ftsWeight,
      }))
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, topK);

    // 5. Buscar detalhes dos chunks + documentos
    const results: SearchResultItem[] = [];
    for (const c of sorted) {
      const [chunk] = await db
        .select({
          id: documentChunks.id,
          content: documentChunks.content,
          metadata: documentChunks.metadata,
        })
        .from(documentChunks)
        .where(eq(documentChunks.id, c.chunkId))
        .limit(1);

      const doc = userDocs.find((d) => d.id === c.documentId);

      // Buscar matéria associada
      const [subj] = await db
        .select({ name: knowledgeSubjects.name })
        .from(documentSubjects)
        .innerJoin(
          knowledgeSubjects,
          eq(documentSubjects.subjectId, knowledgeSubjects.id)
        )
        .where(eq(documentSubjects.documentId, c.documentId))
        .limit(1);

      if (chunk && doc) {
        const meta = chunk.metadata as Record<string, unknown> | null;
        results.push({
          chunkId: c.chunkId,
          documentId: c.documentId,
          documentTitle: doc.title,
          content: (chunk.content ?? "").slice(0, 300),
          score: c.hybridScore,
          vectorScore: c.vectorScore,
          ftsScore: c.ftsScore,
          page: meta?.page as number | undefined,
          sectionTitle: meta?.section_title as string | undefined,
          subjectName: subj?.name ?? undefined,
        });
      }
    }

    return {
      results,
      totalHits: combined.size,
      queryTimeMs: Date.now() - startedAt,
      vectorSearchEnabled,
    };
  },
};
