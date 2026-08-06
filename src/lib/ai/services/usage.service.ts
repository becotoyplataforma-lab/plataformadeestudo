/**
 * ConcursoAI — UsageService
 *
 * Controle de consumo de IA (tokens, custo, mensagens) por usuário e dia.
 * Fronteira AI/Billing: OPEN-004 — este serviço LÊ/REGISTRA o uso no domínio AI;
 * os limites de plano são responsabilidade do domínio Billing (não implementado aqui).
 */
import { UsageRepository } from "../repositories/usage.repository";
import { logger } from "@/lib/observability";
import type { AIModel } from "@/lib/ai/types";

export class UsageError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "UsageError";
    this.code = code;
  }
}

/** Custo por 1M tokens (USD) por modelo — DeepSeek pricing (approx.). */
const COST_PER_MILLION: Record<AIModel, { input: number; output: number }> = {
  flash: { input: 0.27, output: 1.1 },
  pro: { input: 0.55, output: 2.19 },
};

export const USD_TO_BRL = 5.0;

export interface UsageStatus {
  messagesUsed: number;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
}

function startOfDay(d = new Date()): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return day;
}

export const UsageService = {
  /** Uso do usuário no dia atual. */
  async getToday(userId: string): Promise<UsageStatus> {
    const row = await UsageRepository.findByUserAndDay(userId, startOfDay());
    return {
      messagesUsed: row?.messagesCount ?? 0,
      tokensIn: row?.tokensIn ?? 0,
      tokensOut: row?.tokensOut ?? 0,
      totalTokens: (row?.tokensIn ?? 0) + (row?.tokensOut ?? 0),
    };
  },

  /** Registrar uso (incrementa ai_usage do dia). */
  async record(userId: string, tokensIn: number, tokensOut: number) {
    if (tokensIn < 0 || tokensOut < 0) {
      throw new UsageError("INVALID_TOKENS", "Contagem de tokens não pode ser negativa.");
    }
    const row = await UsageRepository.increment(userId, startOfDay(), tokensIn, tokensOut);
    logger.info("usage", "uso registrado", {
      userId,
      tokensIn,
      tokensOut,
      totalTokens: tokensIn + tokensOut,
    });
    return row;
  },

  /** Verificar se o usuário pode enviar (limite informado por Billing). */
  async checkLimit(
    userId: string,
    limit: { maxMessages: number; maxTokens: number }
  ): Promise<{ canSend: boolean; status: UsageStatus }> {
    const status = await this.getToday(userId);
    return {
      canSend: status.messagesUsed < limit.maxMessages && status.totalTokens < limit.maxTokens,
      status,
    };
  },

  /** Estimar custo em BRL (centavos) de uma chamada. */
  estimateCost(model: AIModel, tokensIn: number, tokensOut: number): number {
    const rates = COST_PER_MILLION[model];
    const costUsd =
      (tokensIn / 1_000_000) * rates.input + (tokensOut / 1_000_000) * rates.output;
    // Retorna em BRL, arredondado a 4 casas (valor monetário pequeno por chamada).
    return Math.round(costUsd * USD_TO_BRL * 10000) / 10000;
  },
};
