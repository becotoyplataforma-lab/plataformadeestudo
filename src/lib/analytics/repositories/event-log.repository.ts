/**
 * ConcursoAI — EventLogRepository (Analytics)
 *
 * Persistência do aggregate EventLog (imutável).
 * Escrita/leitura de eventos de negócio (tabela docs/08).
 * O mecanismo de produção de eventos (quem escreve) é OPEN-005 (pós-MVP).
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { eventLogs } from "@/db/schema/analytics";

export const EventLogRepository = {
  /** Registrar um evento (imutável). */
  async create(input: typeof eventLogs.$inferInsert) {
    const [row] = await db.insert(eventLogs).values(input).returning();
    return row;
  },

  /** Listar eventos por entidade (mais recentes primeiro). */
  async findByEntity(entityType: string, entityId?: string, limit = 50) {
    return db
      .select()
      .from(eventLogs)
      .where(
        and(
          eq(eventLogs.entityType, entityType),
          ...(entityId ? [eq(eventLogs.entityId, entityId)] : [])
        )
      )
      .orderBy(desc(eventLogs.occurredAt))
      .limit(limit);
  },

  /** Listar eventos de um usuário (mais recentes primeiro). */
  async findByUser(userId: string, limit = 50) {
    return db
      .select()
      .from(eventLogs)
      .where(eq(eventLogs.userId, userId))
      .orderBy(desc(eventLogs.occurredAt))
      .limit(limit);
  },
};
