/**
 * ConcursoAI — EventLogService (Analytics)
 *
 * Registro e consulta de eventos de negócio (tabela event_logs).
 *
 * O MECANISMO de produção de eventos entre domínios (quem escreve, event bus)
 * é decisão aberta — OPEN-005 (docs/06, pós-MVP). Este serviço expõe a
 * capacidade de escrita/leitura do domínio; a integração com os domínios de
 * origem será definida quando o OPEN-005 for resolvido.
 */
import "server-only";
import { EventLogRepository } from "../repositories/event-log.repository";

export interface RecordEventInput {
  userId?: string;
  entityType: string;
  entityId?: string;
  eventName: string;
  payload?: unknown;
}

export const EventLogService = {
  /** Registra um evento de negócio (imutável). */
  async record(input: RecordEventInput) {
    return EventLogRepository.create({
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      eventName: input.eventName,
      payload: (input.payload ?? null) as never,
      occurredAt: new Date(),
    });
  },

  /** Eventos do usuário (mais recentes primeiro). */
  async listByUser(userId: string, limit = 50) {
    return EventLogRepository.findByUser(userId, limit);
  },

  /** Eventos por entidade. */
  async listByEntity(entityType: string, entityId?: string, limit = 50) {
    return EventLogRepository.findByEntity(entityType, entityId, limit);
  },
};
