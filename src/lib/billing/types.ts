/**
 * ConcursoAI — Billing: tipos de domínio
 *
 * OPEN-004: Billing é dono dos limites (plan.limits). AI registra ai_usage.
 */

/** Estado da assinatura (espelha o enum subscription_status). */
export type SubscriptionStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "past_due"
  | "suspended";

/** Estado do pagamento (espelha o enum payment_status). */
export type PaymentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded";

/** Limites de um plano (JSON `plans.limits` normalizado). */
export interface PlanLimits {
  /** Máximo de mensagens de IA por dia. */
  maxMessages: number;
  /** Máximo de tokens de IA por dia. */
  maxTokens: number;
  /** Máximo de questões respondidas por dia. */
  maxQuestionsPerDay?: number;
  /** Máximo de documentos no Knowledge. */
  maxDocuments?: number;
  /** Libera o modelo `pro` (raciocínio profundo). */
  allowPro?: boolean;
}

/** Limites padrão do plano gratuito (fallback caso o seed não exista). */
export const DEFAULT_FREE_LIMITS: PlanLimits = {
  maxMessages: 5,
  maxTokens: 100_000,
  maxQuestionsPerDay: 20,
  maxDocuments: 3,
  allowPro: false,
};

/** Entitlement resolvido do usuário (plano + assinatura + limites). */
export interface CurrentEntitlement {
  planId: string;
  planCode: string;
  planName: string;
  priceCents: number;
  limits: PlanLimits;
  tier: "free" | "paid";
  subscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

/** Resultado do processamento de um webhook de pagamento. */
export interface WebhookResult {
  received: boolean;
  processed: boolean;
  ignored: boolean;
  duplicate: boolean;
  status: PaymentStatus | null;
}

/** Normaliza o JSON `limits` de um plano com defaults seguros. */
export function normalizeLimits(raw: unknown): PlanLimits {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    maxMessages: Number(obj.maxMessages ?? DEFAULT_FREE_LIMITS.maxMessages),
    maxTokens: Number(obj.maxTokens ?? DEFAULT_FREE_LIMITS.maxTokens),
    maxQuestionsPerDay:
      obj.maxQuestionsPerDay !== undefined
        ? Number(obj.maxQuestionsPerDay)
        : undefined,
    maxDocuments:
      obj.maxDocuments !== undefined ? Number(obj.maxDocuments) : undefined,
    allowPro: obj.allowPro !== undefined ? Boolean(obj.allowPro) : false,
  };
}
