/**
 * ConcursoAI — DailySummaryService (Analytics)
 *
 * Leitura do aggregate DailySummary (um por usuário e dia).
 *
 * Materialização (quando/como escrever) é decisão aberta — OPEN-006 (docs/06).
 * No MVP a agregação é sob demanda (AggregationService); este serviço expõe
 * apenas leitura. A escrita via DailySummaryRepository.upsert fica disponível
 * para o job noturno (V1.1).
 */
import "server-only";
import { DailySummaryRepository } from "../repositories/daily-summary.repository";

export const DailySummaryService = {
  /** Resumo diário do usuário em uma data (null se não materializado). */
  async getForDay(userId: string, date: Date) {
    return DailySummaryRepository.findByUserAndDate(userId, date);
  },

  /** Resumos do usuário em um intervalo. */
  async getRange(userId: string, from: Date, to: Date) {
    return DailySummaryRepository.listByUserInRange(userId, from, to);
  },
};
