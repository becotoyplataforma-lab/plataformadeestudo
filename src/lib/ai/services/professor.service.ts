/**
 * ConcursoAI — ProfessorService (Application Service / Orquestrador)
 *
 * Application Service do Professor IA: orquestra os Engines existentes SEM
 * duplicar lógica. Decide o fluxo (chat direto vs RAG), aplica limite de uso,
 * seleciona modelo, executa o engine escolhido com timeout global e registra
 * consumo.
 *
 * Reutiliza (SEM duplicar):
 * - RagService  → path RAG (internamente: HybridSearch + Prompt + Router + DeepSeek)
 * - ChatService → path chat (internamente: sessão + Prompt + Router + DeepSeek + Usage)
 * - UsageService      → checkLimit / record (path RAG) / estimateCost
 * - ModelRouterService → seleção de modelo
 * - PromptService e DeepSeekProvider → reutilizados de forma transitiva pelos engines
 *
 * Não altera Knowledge, Study nem AI (somente orquestra).
 *
 * OPEN-004 (resolvido na FASE Billing): Billing (EntitlementService) é dono dos
 * limites. O Professor consulta o Billing ANTES de chamar a IA; a IA (UsageService)
 * continua registrando ai_usage. `limit` permanece como fallback injetável (testes).
 */
import "server-only";
import { ragService, type Citation, type RagTokens } from "./rag.service";
import type { RagService } from "./rag.service";
import { ChatService } from "./chat.service";
import { UsageService } from "./usage.service";
import { ModelRouterService } from "./model-router.service";
import { EntitlementService } from "@/lib/billing/services/entitlement.service";
import { logger, now, elapsed } from "@/lib/observability";
import type { AIModel } from "@/lib/ai/types";

// ============================================================
// Intent
// ============================================================

export type ProfessorMode = "auto" | "chat" | "rag";
export type ProfessorIntent = "chat" | "rag";

export interface ProfessorIntentContext {
  message: string;
  subjectId?: string;
  documentIds?: string[];
}

/**
 * Heurística padrão de decisão de intent (decisão de orquestração — MVP).
 * Sem regra de negócio: apenas escolhe entre os dois engines existentes.
 */
export function defaultResolveIntent(ctx: ProfessorIntentContext): ProfessorIntent {
  if (ctx.subjectId || (ctx.documentIds && ctx.documentIds.length > 0)) {
    return "rag";
  }
  const text = ctx.message.toLowerCase();
  const ragKeywords = [
    "material",
    "documento",
    "documentos",
    "edital",
    "apostila",
    "apostilas",
    "lei",
    "art.",
    "artigo",
    "resumo",
    "dos meus",
    "no meu",
  ];
  return ragKeywords.some((k) => text.includes(k)) ? "rag" : "chat";
}

// ============================================================
// Contratos
// ============================================================

/**
 * Limite padrão de segurança (MVP) — usado apenas quando Billing não é injetado
 * (fallback em testes). Em runtime, o Professor consulta o Billing (OPEN-004).
 */
export const DEFAULT_USAGE_LIMIT = { maxMessages: 100, maxTokens: 1_000_000 };
export const DEFAULT_TIMEOUT_MS = 30_000;

export interface ProfessorDependencies {
  rag: Pick<RagService, "answer">;
  chat: Pick<typeof ChatService, "send">;
  usage: Pick<typeof UsageService, "checkLimit" | "record" | "estimateCost">;
  router: Pick<typeof ModelRouterService, "route">;
  resolveIntent?: (ctx: ProfessorIntentContext) => ProfessorIntent;
  /**
   * Billing (Entitlement) — dono dos limites (OPEN-004).
   * Quando presente, os limites vêm do plano do usuário; `limit` vira fallback.
   */
  billing?: Pick<typeof EntitlementService, "getLimits">;
  limit?: { maxMessages: number; maxTokens: number };
}

export interface ProfessorInput {
  message: string;
  userId: string;
  mode?: ProfessorMode;
  sessionId?: string;
  subjectId?: string;
  documentIds?: string[];
  topK?: number;
  model?: AIModel;
  timeoutMs?: number;
}

export interface ProfessorOutput {
  answer: string;
  mode: ProfessorIntent;
  model: AIModel;
  citations: Citation[];
  documents: string[];
  chunksUsed: number;
  tokens: RagTokens;
  costBRL: number;
  latencyMs: number;
  confidence: number;
}

export class ProfessorError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ProfessorError";
    this.code = code;
  }
}

// ============================================================
// Service (classe com injeção de dependências)
// ============================================================

export class ProfessorService {
  constructor(private readonly deps: ProfessorDependencies) {}

  /**
   * Pipeline completo do Professor IA:
   * Question → Intent → Contexto/Engine → Model Router → DeepSeek → Usage → Response.
   */
  async ask(input: ProfessorInput): Promise<ProfessorOutput> {
    const startedAt = now();
    const { message, userId } = input;

    logger.info("professor", "pergunta recebida", {
      userId,
      mode: input.mode ?? "auto",
      hasSubjectId: Boolean(input.subjectId),
      hasDocumentIds: Boolean(input.documentIds && input.documentIds.length > 0),
    });

    if (!message || message.trim().length === 0) {
      logger.warn("professor", "pergunta vazia", { userId });
      throw new ProfessorError("EMPTY_QUESTION", "A pergunta não pode ser vazia.");
    }

    // 1. Limite de uso — Billing é dono dos limites (OPEN-004).
    //    Professor consulta o Billing ANTES de chamar a IA; a IA registra ai_usage.
    const limit = this.deps.billing
      ? await this.deps.billing.getLimits(userId)
      : this.deps.limit ?? DEFAULT_USAGE_LIMIT;
    const { canSend } = await this.deps.usage.checkLimit(userId, limit);
    if (!canSend) {
      logger.warn("professor", "limite de uso diário atingido", {
        userId,
        limit,
      });
      throw new ProfessorError("LIMIT_EXCEEDED", "Limite de uso diário atingido.");
    }

    // 2. Intent — decide entre chat direto e RAG
    const intent = this.resolveIntent(input);

    // 3. Seleção de modelo
    const model = this.deps.router.route({ requested: input.model });

    // 4. Execução do engine com timeout global
    const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    logger.info("professor", "intent resolvida", {
      userId,
      intent,
      model,
    });

    const result =
      intent === "rag"
        ? await this.runRag(input, model, timeoutMs, startedAt)
        : await this.runChat(input, model, timeoutMs, startedAt);

    logger.info("professor", "resposta enviada", {
      userId,
      mode: result.mode,
      model: result.model,
      totalTimeMs: elapsed(startedAt),
      tokensIn: result.tokens.in,
      tokensOut: result.tokens.out,
      totalTokens: result.tokens.total,
      costBRL: result.costBRL,
      citations: result.citations.length,
    });

    return result;
  }

  // ============================================================
  // Paths
  // ============================================================

  /** Path RAG: delega ao RagService e registra consumo (RagService não registra). */
  private async runRag(
    input: ProfessorInput,
    model: AIModel,
    timeoutMs: number,
    startedAt: number
  ): Promise<ProfessorOutput> {
    const out = await this.withTimeout(
      this.deps.rag.answer({
        question: input.message,
        userId: input.userId,
        subjectId: input.subjectId,
        documentIds: input.documentIds,
        topK: input.topK,
        model,
      }),
      timeoutMs
    );

    // Registra uso somente quando houve chamada ao LLM
    // (fallback sem contexto não consome tokens e não conta como mensagem).
    if (out.tokens.total > 0) {
      await this.deps.usage.record(input.userId, out.tokens.in, out.tokens.out);
    }

    return {
      answer: out.answer,
      mode: "rag",
      model: out.model,
      citations: out.citations,
      documents: out.documents,
      chunksUsed: out.chunksUsed,
      tokens: out.tokens,
      costBRL: this.deps.usage.estimateCost(out.model, out.tokens.in, out.tokens.out),
      latencyMs: Date.now() - startedAt,
      confidence: out.confidence,
    };
  }

  /** Path chat: delega ao ChatService (que já registra usage internamente). */
  private async runChat(
    input: ProfessorInput,
    model: AIModel,
    timeoutMs: number,
    startedAt: number
  ): Promise<ProfessorOutput> {
    const result = await this.withTimeout(
      this.deps.chat.send({
        userId: input.userId,
        message: input.message,
        sessionId: input.sessionId,
        subjectId: input.subjectId,
        model,
      }),
      timeoutMs
    );

    return {
      answer: result.response,
      mode: "chat",
      model: result.model,
      citations: [],
      documents: [],
      chunksUsed: 0,
      tokens: {
        in: result.tokensIn,
        out: result.tokensOut,
        total: result.totalTokens,
      },
      costBRL: result.costBRL,
      latencyMs: Date.now() - startedAt,
      confidence: 0,
    };
  }

  // ============================================================
  // Helpers
  // ============================================================

  /** Decide o engine: modo explícito vence; senão usa a heurística injetada/padrão. */
  private resolveIntent(input: ProfessorInput): ProfessorIntent {
    if (input.mode === "chat" || input.mode === "rag") {
      return input.mode;
    }
    const resolver = this.deps.resolveIntent ?? defaultResolveIntent;
    return resolver({
      message: input.message,
      subjectId: input.subjectId,
      documentIds: input.documentIds,
    });
  }

  /** Aplica timeout global ao engine (backstop do timeout interno do RAG). */
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new ProfessorError("TIMEOUT", `Tempo limite excedido (${ms}ms).`)),
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

export const professorService = new ProfessorService({
  rag: ragService,
  chat: ChatService,
  usage: UsageService,
  router: ModelRouterService,
  resolveIntent: defaultResolveIntent,
  // OPEN-004: Billing é dono dos limites — o Professor consulta o entitlement.
  billing: EntitlementService,
});
