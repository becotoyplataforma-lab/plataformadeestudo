/**
 * ConcursoAI — RagService
 *
 * RAG Engine (MVP): recupera contexto relevante dos documentos do usuário via
 * HybridSearchService, monta o prompt via PromptService e gera resposta
 * fundamentada via DeepSeekProvider — com citações e score de confiança.
 *
 * Segue:
 * - docs/ENGINE-ARCHITECTURE.md (RAG Engine)
 * - docs/13-KNOWLEDGE-CORE-ARCHITECTURE.md (pipeline RAG)
 * - docs/10-EMBEDDING-STANDARD.md (Hybrid Search)
 *
 * Dependências injetadas (testável). Sem lógica de negócio em API Routes.
 */
import "server-only";
import { HybridSearchService } from "@/lib/knowledge/services/hybrid-search.service";
import { PromptService } from "./prompt.service";
import { DeepSeekProvider } from "./deepseek-provider.service";
import { ModelRouterService } from "./model-router.service";
import { logger, now, elapsed } from "@/lib/observability";
import type { AIModel } from "@/lib/ai/types";

// ============================================================
// Contratos
// ============================================================

export interface RagDependencies {
  search: Pick<typeof HybridSearchService, "search">;
  prompt: Pick<typeof PromptService, "buildSystemPrompt" | "buildMessages">;
  provider: Pick<typeof DeepSeekProvider, "complete">;
  router: Pick<typeof ModelRouterService, "route">;
}

export interface RagInput {
  question: string;
  userId: string;
  subjectId?: string;
  documentIds?: string[];
  topK?: number;
  model?: AIModel;
  timeoutMs?: number;
}

export interface Citation {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  score: number;
  subject: string | null;
  topic: string | null;
}

export interface RagTokens {
  in: number;
  out: number;
  total: number;
}

export interface RagOutput {
  answer: string;
  citations: Citation[];
  documents: string[];
  chunksUsed: number;
  tokens: RagTokens;
  latencyMs: number;
  model: AIModel;
  confidence: number;
  /** Métrica: tempo da busca híbrida (ms) — medido pelo HybridSearch (queryTimeMs). */
  searchTimeMs: number;
  /** Métrica: tempo da chamada ao provedor (ms). */
  providerTimeMs: number;
}

export class RagError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RagError";
    this.code = code;
  }
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;

const NO_CONTEXT_ANSWER =
  "Não encontrei material suficiente nos seus documentos sobre este tema. " +
  "Sugiro fazer upload de materiais relacionados (editais, apostilas, leis) para que eu possa responder com base neles.";

// ============================================================
// Service (classe com injeção de dependências)
// ============================================================

export class RagService {
  constructor(private readonly deps: RagDependencies) {}

  /**
   * Responde com base nos documentos do usuário (RAG).
   */
  async answer(input: RagInput): Promise<RagOutput> {
    const startedAt = Date.now();
    const { question, userId } = input;

    if (!question || question.trim().length === 0) {
      throw new RagError("EMPTY_QUESTION", "A pergunta não pode ser vazia.");
    }

    const topK = Math.min(Math.max(input.topK ?? DEFAULT_TOP_K, 1), MAX_TOP_K);

    // 1. Recuperar chunks relevantes (Hybrid Search)
    const search = await this.deps.search.search({
      query: question,
      userId,
      filters: {
        ...(input.subjectId && { subjectId: input.subjectId }),
        // HybridSearch suporta um único documentId por consulta no MVP.
        ...(input.documentIds && input.documentIds.length > 0 && {
          documentId: input.documentIds[0],
        }),
      },
      topK,
    });
    // Tempo de busca é medido pelo HybridSearch (queryTimeMs).
    const searchTimeMs = search.queryTimeMs;

    logger.info("hybrid-search", "busca concluída", {
      userId,
      searchTimeMs,
      hits: search.results.length,
      totalHits: search.totalHits,
    });

    // 2. Sem contexto → fallback (sem chamada ao LLM)
    if (search.results.length === 0) {
      logger.info("rag", "sem contexto — resposta fallback", {
        userId,
        searchTimeMs,
        topK,
      });
      return {
        answer: NO_CONTEXT_ANSWER,
        citations: [],
        documents: [],
        chunksUsed: 0,
        tokens: { in: 0, out: 0, total: 0 },
        latencyMs: Date.now() - startedAt,
        model: this.deps.router.route({ requested: input.model }),
        confidence: 0,
        searchTimeMs,
        providerTimeMs: 0,
      };
    }

    // 3. Selecionar chunks e montar contexto
    const context = this.buildContext(search.results);

    // 4. Modelo
    const model = this.deps.router.route({ requested: input.model });

    // 5. Prompt via PromptService (system + contexto + pergunta)
    const systemPrompt = await this.deps.prompt.buildSystemPrompt({
      subjectName: search.results[0]?.subjectName ?? undefined,
    });
    const userMessage = `Material de apoio (use como base, citando a fonte):\n\n${context}\n\nPergunta do aluno:\n${question}`;
    const messages = await this.deps.prompt.buildMessages(systemPrompt, [], userMessage);

    // 6. Provedor (com timeout) + métrica de tempo do provider
    const providerStartedAt = now();
    const providerResult = await this.withTimeout(
      this.deps.provider.complete({ model, messages }),
      input.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
    const providerTimeMs = elapsed(providerStartedAt);

    // 7. Citações (somente a partir dos chunks recuperados — nunca inventadas)
    const citations: Citation[] = search.results.map((r) => ({
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      chunkId: r.chunkId,
      score: r.score,
      subject: r.subjectName ?? null,
      // HybridSearch ainda não expõe tópico no MVP → null (não inventar).
      topic: null,
    }));

    const documents = [...new Set(search.results.map((r) => r.documentId))];

    logger.info("rag", "resposta gerada com contexto", {
      userId,
      searchTimeMs,
      providerTimeMs,
      ragTimeMs: Date.now() - startedAt,
      chunks: search.results.length,
      documents: documents.length,
      tokensIn: providerResult.tokensIn,
      tokensOut: providerResult.tokensOut,
      model: providerResult.model,
      confidence: this.computeConfidence(search.results),
    });

    return {
      answer: providerResult.content,
      citations,
      documents,
      chunksUsed: search.results.length,
      tokens: {
        in: providerResult.tokensIn,
        out: providerResult.tokensOut,
        total: providerResult.tokensIn + providerResult.tokensOut,
      },
      latencyMs: Date.now() - startedAt,
      model: providerResult.model,
      confidence: this.computeConfidence(search.results),
      searchTimeMs,
      providerTimeMs,
    };
  }

  // ============================================================
  // Helpers
  // ============================================================

  /** Monta o texto de contexto a partir dos chunks (numbered). */
  private buildContext(
    results: { documentTitle: string; sectionTitle?: string; content: string }[]
  ): string {
    return results
      .map((r, i) => {
        const heading = r.sectionTitle ? ` - ${r.sectionTitle}` : "";
        return `[${i + 1}] (${r.documentTitle}${heading})\n${r.content}`;
      })
      .join("\n\n");
  }

  /** Confiança baseada no melhor score de recuperação (0-1, MVP). */
  private computeConfidence(
    results: { score: number }[]
  ): number {
    if (results.length === 0) return 0;
    const maxScore = Math.max(...results.map((r) => r.score));
    return Math.min(1, Math.max(0, maxScore));
  }

  /** Aplica timeout à chamada do provedor. */
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new RagError("TIMEOUT", `Tempo limite excedido (${ms}ms).`)),
        ms
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

// ============================================================
// Singleton padrão (dependências reais) — usado pelas API Routes
// ============================================================

export const ragService = new RagService({
  search: HybridSearchService,
  prompt: PromptService,
  provider: DeepSeekProvider,
  router: ModelRouterService,
});
