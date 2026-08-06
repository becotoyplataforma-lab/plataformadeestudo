import "server-only";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { Plan } from "@/types";

/**
 * Cotas de IA por plano (ver docs/03-AIDD.md e sql/schema.sql).
 * A função SQL get_plan_limits é a fonte da verdade; este helper
 * espelha os valores para uso em TS no servidor.
 */
const PLAN_LIMITS: Record<Plan, { maxMessages: number; maxTokens: number }> = {
  free: { maxMessages: 50, maxTokens: 100_000 },
  pro: { maxMessages: 500, maxTokens: 1_000_000 },
  intensivo: { maxMessages: 2_000, maxTokens: 5_000_000 },
};

export interface UsageStatus {
  usedMessages: number;
  usedTokens: number;
  maxMessages: number;
  maxTokens: number;
  remainingMessages: number;
  canSend: boolean;
  plan: Plan;
}

/** Retorna o status de uso de IA do usuário no dia atual. */
export async function getAiUsage(userId: string): Promise<UsageStatus> {
  const db = await createSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);

  // Plano do usuário
  const { data: profile } = await db
    .from("profiles")
    .select("plano")
    .eq("id", userId)
    .single();
  const plan = (profile?.plano as Plan) ?? "free";

  // Uso do dia (ai_usage é gerenciado via RPC DEFINER no fluxo real;
  // aqui lemos de forma direta para fins de exibição)
  const { data } = await db
    .from("ai_usage")
    .select("messages_count, tokens_in, tokens_out")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();

  const limits = PLAN_LIMITS[plan];
  const usedMessages = data?.messages_count ?? 0;
  const usedTokens = (data?.tokens_in ?? 0) + (data?.tokens_out ?? 0);

  return {
    usedMessages,
    usedTokens,
    maxMessages: limits.maxMessages,
    maxTokens: limits.maxTokens,
    remainingMessages: Math.max(0, limits.maxMessages - usedMessages),
    canSend: usedMessages < limits.maxMessages,
    plan,
  };
}

/** Registra uso de IA via RPC (SECURITY DEFINER no banco). */
export async function registerUsage(
  userId: string,
  tokensIn: number,
  tokensOut: number
): Promise<void> {
  const db = await createSupabaseClient();
  // A tabela ai_usage não tem política RLS — a função é SECURITY DEFINER.
  const { error } = await db.rpc("register_ai_usage", {
    p_user_id: userId,
    p_tokens_in: tokensIn,
    p_tokens_out: tokensOut,
  });
  // Ignora erro se a função não existir (dev) — loga apenas
  if (error) {
    console.warn("[ai-usage] Falha ao registrar uso:", error.message);
  }
}
