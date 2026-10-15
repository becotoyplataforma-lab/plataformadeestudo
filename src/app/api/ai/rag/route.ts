/**
 * POST /api/ai/rag
 *
 * Responde com base nos documentos do usuário (RAG Engine).
 * Fluxo: interruptor de disponibilidade -> sessão -> rate limit -> limites do
 *        plano -> quota de uso -> escopo do perfil autenticado -> RagService ->
 *        HybridSearchService (política central de acesso) -> PromptService ->
 *        DeepSeekProvider -> registro de uso -> resposta.
 *
 * Interruptor (decisão de produto):
 *   A rota está DESATIVADA POR PADRÃO até existir uma consumidora funcional.
 *   `RAG_API_DISABLED` é lida de forma estrita: só "true" e "false" (espaço e
 *   maiúscula tolerados) são reconhecidos. Ausente, vazio ou inválido mantém a
 *   rota em 503 — liberação exige opt-in explícito `RAG_API_DISABLED=false`.
 *   O valor configurado nunca é ecoado na resposta nem no log (sem segredo,
 *   sem payload do cliente). O check acontece antes de `auth()`, de qualquer
 *   leitura de banco e de qualquer serviço pago (RAG, embedding, DeepSeek).
 *
 * Segurança e custo que continuam valendo quando a rota é habilitada (o
 * interruptor não substitui nenhuma destas barreiras):
 *  1. Sessão válida obrigatória: sem usuário autenticado não há chamada de IA.
 *  2. `position_id`/`edital_id` nunca vêm do cliente: o escopo é resolvido a
 *     partir do perfil autenticado e o filtro de acesso acontece dentro do SQL
 *     do HybridSearchService (`documentAccessCondition`). `document_ids` apenas
 *     estreita o conjunto já autorizado — nunca abre acesso novo.
 *  3. A quota diária do plano (Billing) é verificada ANTES de gastar tokens. Se a
 *     leitura de uso falhar, a requisição é negada (fail closed) em vez de seguir
 *     sem contabilização.
 *  4. Toda tentativa que alcança o provedor é registrada em `ai_usage`, inclusive
 *     a que falha: erro repetido não vira uso gratuito.
 *  5. Modelo `pro` exige plano que o permita (regra do EntitlementService).
 *  6. Limites de entrada: corpo até 16 KB, pergunta até 2000 caracteres,
 *     `top_k` 1-20, `document_ids` até 20 UUIDs.
 *  7. Timeout do provedor (RagService, 20s) e mapeamento explícito de
 *     400/403/408/413/429/500/502/503.
 *
 * Toda a lógica de negócio permanece nos Services (nenhuma regra aqui).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { ragService, RagError } from "@/lib/ai/services/rag.service";
import { ProviderError } from "@/lib/ai/services/deepseek-provider.service";
import { UsageService } from "@/lib/ai/services/usage.service";
import { resolveUserLimits } from "@/lib/billing/services/limits.resolver";
import { EntitlementService } from "@/lib/billing/services/entitlement.service";
import { RagRequestDtoSchema, mapRagOutputToDto } from "@/lib/dto/rag.dto";
import { getProfile } from "@/lib/db/repositories/perfil";
import { resolveCourseScope } from "@/lib/knowledge/security/course-scope";
import { rateLimit } from "@/lib/security/rate-limit";
import { logger } from "@/lib/observability";

// TODO: migrar rate limiter para Redis/Upstash quando escalar para múltiplas réplicas
export const runtime = "nodejs";
/** Teto de execução: o RagService corta o provedor em 20s; 30s cobre busca + IA. */
export const maxDuration = 30;

/** Teto do corpo JSON: a pergunta tem teto de 2000 caracteres, o resto é id. */
const MAX_BODY_BYTES = 16 * 1024;

/** Estado interpretado de `RAG_API_DISABLED` (somente true/false são válidos). */
type DisableFlagState = "absent" | "empty" | "true" | "false" | "invalid";

interface DisableFlag {
  disabled: boolean;
  state: DisableFlagState;
}

/**
 * Lê o interruptor de forma estrita. Nada de `Boolean(x)` ou truthiness: a
 * string "0" ou "nao" não pode virar liberação acidental de rota.
 */
function readDisableFlag(): DisableFlag {
  const raw = process.env.RAG_API_DISABLED;
  if (raw === undefined) return { disabled: true, state: "absent" };
  const value = raw.trim().toLowerCase();
  if (value === "") return { disabled: true, state: "empty" };
  if (value === "true") return { disabled: true, state: "true" };
  if (value === "false") return { disabled: false, state: "false" };
  return { disabled: true, state: "invalid" };
}

function unavailable() {
  return NextResponse.json(
    {
      error: "RAG_ENDPOINT_DISABLED",
      message: "Serviço de consulta RAG indisponível neste momento.",
    },
    { status: 503 }
  );
}

/**
 * Registra o consumo do dia. Retorna false quando a escrita falha: a rota decide
 * o que fazer (negar a resposta ou preservar o erro original) em vez de engolir
 * a falha de contabilização em silêncio.
 */
async function accountUsage(
  userId: string,
  tokensIn: number,
  tokensOut: number
): Promise<boolean> {
  try {
    await UsageService.record(userId, tokensIn, tokensOut);
    return true;
  } catch (error) {
    logger.error("rag", "Falha ao registrar uso de IA", {
      event: "USAGE_RECORD_FAILED",
      userId,
      tokensIn,
      tokensOut,
    });
    console.error("[ai/rag] Falha ao registrar uso de IA:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  // 0. Disponibilidade: antes de sessão, banco, busca ou provedor.
  const flag = readDisableFlag();
  if (flag.disabled) {
    if (flag.state === "invalid") {
      logger.error("rag", "Valor de RAG_API_DISABLED não reconhecido", {
        event: "RAG_DISABLE_FLAG_INVALID",
        layer: "api/ai/rag",
        reason: "VALOR_NAO_RECONHECIDO",
      });
    }
    return unavailable();
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const userId = session.user.id;

    // Rate limit de curto prazo (anti-abuso): 30 consultas/minuto por usuário.
    const burstRl = rateLimit("rag-burst", `user:${userId}`, 30, 60 * 1000);
    if (!burstRl.allowed) {
      return NextResponse.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: "Muitas consultas em sequência. Aguarde alguns segundos e tente novamente.",
        },
        { status: 429 }
      );
    }

    // Teto de corpo antes de interpretar JSON (evita parse de payload gigante).
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "PAYLOAD_TOO_LARGE", message: "Corpo da requisição excede o limite." },
        { status: 413 }
      );
    }
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "PAYLOAD_TOO_LARGE", message: "Corpo da requisição excede o limite." },
        { status: 413 }
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Requisição inválida", message: "Corpo não é JSON válido." },
        { status: 400 }
      );
    }

    const parsed = RagRequestDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Limites do plano: Billing é o dono da quota (OPEN-004). Sem assinatura ou
    // com falha de resolução, resolveUserLimits devolve o gratuito.
    const limits = await resolveUserLimits(userId);

    // Modelo: `pro` só com plano que o permita. A regra mora no Billing; o
    // caminho comum (flash/kimi) não paga uma leitura extra.
    const requested = parsed.data.model;
    if (requested && requested !== "flash" && requested !== "kimi") {
      const allowed = await EntitlementService.canUseModel(userId, requested).catch(() => false);
      if (!allowed) {
        logger.warn("rag", "Modelo não disponível no plano", {
          event: "MODEL_NOT_ALLOWED",
          userId,
          model: requested,
        });
        return NextResponse.json(
          {
            error: "MODEL_NOT_ALLOWED",
            message: "O modelo solicitado não está disponível no seu plano.",
          },
          { status: 403 }
        );
      }
    }

    // Quota diária, antes de qualquer gasto de tokens. Falha na leitura nega a
    // requisição: sem contador não há como provar que o usuário tem cota.
    let quota: Awaited<ReturnType<typeof UsageService.checkLimit>>;
    try {
      quota = await UsageService.checkLimit(userId, {
        maxMessages: limits.maxMessages,
        maxTokens: limits.maxTokens,
      });
    } catch (error) {
      logger.error("rag", "Falha ao consultar uso diário de IA", {
        event: "USAGE_CHECK_FAILED",
        userId,
      });
      console.error("[ai/rag] Falha ao consultar uso diário:", error);
      return NextResponse.json(
        {
          error: "USAGE_UNAVAILABLE",
          message: "Não foi possível verificar seu consumo de IA. Tente novamente.",
        },
        { status: 503 }
      );
    }
    if (!quota.canSend) {
      logger.warn("rag", "Limite de uso diário atingido", {
        event: "LIMIT_EXCEEDED",
        userId,
        messagesUsed: quota.status.messagesUsed,
        maxMessages: limits.maxMessages,
        tokensUsed: quota.status.totalTokens,
        maxTokens: limits.maxTokens,
      });
      return NextResponse.json(
        {
          error: "LIMIT_EXCEEDED",
          message: "Limite de uso diário de IA atingido. Aguarde a próxima janela ou faça upgrade.",
          usage: {
            messages_used: quota.status.messagesUsed,
            max_messages: limits.maxMessages,
            tokens_used: quota.status.totalTokens,
            max_tokens: limits.maxTokens,
          },
        },
        { status: 429 }
      );
    }

    // Isolamento por curso/cargo/edital: o escopo é resolvido no backend a
    // partir do perfil autenticado (fonte de verdade). O cliente NÃO pode
    // definir ou sobrescrever positionId/editalId, e o filtro de documentos é
    // aplicado dentro do SQL do HybridSearchService.
    const profile = await getProfile(userId).catch(() => null);
    const courseScope = await resolveCourseScope(profile);

    const result = await ragService
      .answer({
        question: parsed.data.question,
        userId,
        subjectId: parsed.data.subject_id,
        documentIds: parsed.data.document_ids,
        topK: parsed.data.top_k,
        model: requested,
        positionId: courseScope.positionId,
        editalId: courseScope.editalId,
      })
      .catch(async (error: unknown) => {
        // A tentativa que alcançou o provedor também conta. Tokens 0/0 porque na
        // falha não sabemos quanto foi consumido; a mensagem conta como uso.
        await accountUsage(userId, 0, 0);
        throw error;
      });

    // Contabilização do consumo real. Falha aqui devolve erro em vez de entregar
    // conteúdo não contabilizado (o custo já aconteceu; a resposta, não).
    if (result.tokens.total > 0) {
      const recorded = await accountUsage(userId, result.tokens.in, result.tokens.out);
      if (!recorded) {
        return NextResponse.json(
          {
            error: "USAGE_RECORD_FAILED",
            message: "Não foi possível registrar seu consumo; a resposta não foi entregue.",
          },
          { status: 500 }
        );
      }
      logger.info("rag", "consumo contabilizado", {
        userId,
        model: result.model,
        tokensIn: result.tokens.in,
        tokensOut: result.tokens.out,
        costBRL: UsageService.estimateCost(result.model, result.tokens.in, result.tokens.out),
      });
    }

    return NextResponse.json(mapRagOutputToDto(result));
  } catch (error) {
    if (error instanceof RagError) {
      const status = error.code === "EMPTY_QUESTION" ? 400 : 408;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    if (error instanceof ProviderError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 502 });
    }
    console.error("[ai/rag] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao processar a pergunta." },
      { status: 500 }
    );
  }
}