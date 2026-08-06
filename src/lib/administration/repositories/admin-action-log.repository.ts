/**
 * ConcursoAI — AdminActionLogRepository (Administration)
 *
 * Persistência do aggregate AdminActionLog (auditoria — imutável, docs/08).
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { adminActionLogs } from "@/db/schema/administration";

export const AdminActionLogRepository = {
  /** Registrar ação administrativa (imutável). */
  async create(input: typeof adminActionLogs.$inferInsert) {
    const [row] = await db.insert(adminActionLogs).values(input).returning();
    return row;
  },

  /** Listar ações recentes (todas — tela de auditoria). */
  async listRecent(limit = 50) {
    return db
      .select()
      .from(adminActionLogs)
      .orderBy(desc(adminActionLogs.createdAt))
      .limit(limit);
  },

  /** Listar ações de um administrador. */
  async listByAdmin(adminId: string, limit = 50) {
    return db
      .select()
      .from(adminActionLogs)
      .where(eq(adminActionLogs.adminId, adminId))
      .orderBy(desc(adminActionLogs.createdAt))
      .limit(limit);
  },

  /** Listar ações por tipo de entidade. */
  async listByEntity(entityType: string, limit = 50) {
    return db
      .select()
      .from(adminActionLogs)
      .where(eq(adminActionLogs.entityType, entityType))
      .orderBy(desc(adminActionLogs.createdAt))
      .limit(limit);
  },
};
