/**
 * ConcursoAI — HybridSearchService
 *
 * Busca combinada (vetorial + Full Text Search) sobre documentos do usuário.
 *
 * Segue: .ai/blueprints/05-hybrid-search.blueprint.md
 */
import { and, eq, isNull, sql, or, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import {
  documents,
  documentChunks,
  embeddings,
  documentSubjects,
  knowledgeSubjects,
} from "@/db/schema/knowledge";

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
}

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
      return { results: [], totalHits: 0, queryTimeMs: 0 };
    }

    // 1. Obter IDs de documentos do usuário
    const userDocs = await db
      .select({ id: documents.id, title: documents.title })
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          isNull(documents.deletedAt),
          eq(documents.status, "indexed")
        )
      );

    const userDocIds = userDocs.map((d) => d.id);
    if (userDocIds.length === 0) {
      return { results: [], totalHits: 0, queryTimeMs: Date.now() - startedAt };
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
      return { results: [], totalHits: 0, queryTimeMs: Date.now() - startedAt };
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
      return { results: [], totalHits: 0, queryTimeMs: Date.now() - startedAt };
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

    // 3. Combinar resultados
    // No MVP sem BAAI/bge-m3 real, a busca vetorial usa FTS como fallback
    // V1.1: adicionar busca vetorial com embedding da query

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

    // 4. Construir resultados
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
    };
  },
};
