/**
 * ConcursoAI — ChatRepository
 *
 * Camada de persistência do aggregate ChatSession (+ ChatMessage).
 */
import { eq, and, isNull, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { chatSessions, chatMessages } from "@/db/schema/ai";
import type { AIModel } from "@/lib/ai/types";

export const ChatRepository = {
  // ============================================================
  // SESSIONS
  // ============================================================

  /** Buscar sessão por ID (valida ownership). */
  async findSessionById(id: string, userId: string) {
    const [row] = await db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, id),
          eq(chatSessions.userId, userId),
          isNull(chatSessions.deletedAt)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /** Listar sessões do usuário (mais recentes primeiro). */
  async listSessionsByUser(userId: string, limit = 50) {
    return db
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.userId, userId),
          isNull(chatSessions.deletedAt)
        )
      )
      .orderBy(desc(chatSessions.updatedAt))
      .limit(limit);
  },

  /** Criar sessão. */
  async createSession(input: typeof chatSessions.$inferInsert) {
    const [row] = await db.insert(chatSessions).values(input).returning();
    return row;
  },

  /** Atualizar título da sessão. */
  async updateSessionTitle(id: string, userId: string, title: string) {
    const [row] = await db
      .update(chatSessions)
      .set({ title, updatedAt: new Date() })
      .where(
        and(
          eq(chatSessions.id, id),
          eq(chatSessions.userId, userId),
          isNull(chatSessions.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  },

  /** Touch (atualiza updated_at — mantém sessão no topo). */
  async touchSession(id: string, userId: string) {
    const [row] = await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(chatSessions.id, id),
          eq(chatSessions.userId, userId),
          isNull(chatSessions.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  },

  /** Soft delete de sessão. */
  async softDeleteSession(id: string, userId: string) {
    const [row] = await db
      .update(chatSessions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(chatSessions.id, id),
          eq(chatSessions.userId, userId),
          isNull(chatSessions.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  },

  // ============================================================
  // MESSAGES
  // ============================================================

  /** Criar mensagem. */
  async createMessage(input: typeof chatMessages.$inferInsert) {
    const [row] = await db.insert(chatMessages).values(input).returning();
    return row;
  },

  /** Listar mensagens de uma sessão (cronológicas). */
  async listMessagesBySession(sessionId: string, limit = 100) {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit);
  },

  /** Últimas N mensagens de uma sessão (contexto do prompt). */
  async getRecentContext(sessionId: string, limit = 10) {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  },

  /** Modelo de um tipo específico de sessão para compatibilidade. */
  async getSessionModel(sessionId: string): Promise<AIModel | null> {
    const [row] = await db
      .select({ model: chatSessions.model })
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .limit(1);
    return row?.model ?? null;
  },
};
