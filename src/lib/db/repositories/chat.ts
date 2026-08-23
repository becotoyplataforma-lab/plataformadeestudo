import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { chatSessions, chatMessages } from "@/db/schema/ai";
import type { ChatMessage, ChatSession } from "@/types";
import type { AIModel } from "@/lib/ai/types";

type SessionRow = typeof chatSessions.$inferSelect;
type MessageRow = typeof chatMessages.$inferSelect;

function normalizeChatSession(row: SessionRow): ChatSession {
  return {
    id: row.id,
    user_id: row.userId,
    title: row.title,
    knowledge_subject_id: row.knowledgeSubjectId,
    subject_id: row.knowledgeSubjectId,
    model: row.model,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    session_id: row.sessionId,
    user_id: row.userId,
    role: row.role,
    content: row.content,
    model: row.model,
    tokens_in: row.tokensIn,
    tokens_out: row.tokensOut,
    created_at: row.createdAt.toISOString(),
  };
}

/** Lista sessões de conversa do usuário (mais recentes primeiro). */
export async function listSessions(userId: string): Promise<ChatSession[]> {
  const rows = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, userId), isNull(chatSessions.deletedAt)))
    .orderBy(desc(chatSessions.updatedAt));
  return rows.map(normalizeChatSession);
}

/** Busca sessão por ID (valida ownership). */
export async function getSession(
  userId: string,
  sessionId: string
): Promise<ChatSession | null> {
  const [row] = await db
    .select()
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.userId, userId),
        isNull(chatSessions.deletedAt)
      )
    )
    .limit(1);
  return row ? normalizeChatSession(row) : null;
}

/** Cria sessão (usa knowledge_subject_id no lugar de subject_id). */
export async function createSession(
  userId: string,
  input: {
    title?: string;
    subject_id?: string | null;
    knowledge_subject_id?: string | null;
    model?: AIModel;
  }
): Promise<ChatSession> {
  const knowledgeSubjectId = input.knowledge_subject_id ?? input.subject_id ?? null;
  const [row] = await db
    .insert(chatSessions)
    .values({
      userId,
      title: input.title ?? "Nova conversa",
      knowledgeSubjectId,
      model: input.model ?? "flash",
    })
    .returning();
  return normalizeChatSession(row);
}

export async function updateSessionTitle(
  userId: string,
  sessionId: string,
  title: string
): Promise<void> {
  await db
    .update(chatSessions)
    .set({ title, updatedAt: new Date() })
    .where(
      and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.userId, userId),
        isNull(chatSessions.deletedAt)
      )
    );
}

export async function touchSession(
  userId: string,
  sessionId: string
): Promise<void> {
  await db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.userId, userId),
        isNull(chatSessions.deletedAt)
      )
    );
}

export async function deleteSession(
  userId: string,
  sessionId: string
): Promise<void> {
  await db
    .update(chatSessions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.userId, userId),
        isNull(chatSessions.deletedAt)
      )
    );
}

/** Histórico de mensagens de uma sessão (crescente). */
export async function listMessages(
  userId: string,
  sessionId: string
): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.sessionId, sessionId),
        eq(chatMessages.userId, userId)
      )
    )
    .orderBy(asc(chatMessages.createdAt));
  return rows.map(toChatMessage);
}

export async function insertMessage(msg: {
  session_id: string;
  user_id: string;
  role: "system" | "user" | "assistant";
  content: string;
  model?: AIModel | null;
  tokens_in?: number;
  tokens_out?: number;
}): Promise<ChatMessage> {
  const [row] = await db
    .insert(chatMessages)
    .values({
      sessionId: msg.session_id,
      userId: msg.user_id,
      role: msg.role,
      content: msg.content,
      model: msg.model ?? null,
      tokensIn: msg.tokens_in ?? 0,
      tokensOut: msg.tokens_out ?? 0,
    })
    .returning();
  return toChatMessage(row);
}

/** Últimas N mensagens para montar contexto do LLM (janela deslizante). */
export async function getRecentContext(
  userId: string,
  sessionId: string,
  limit = 10
): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.sessionId, sessionId),
        eq(chatMessages.userId, userId)
      )
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
  return rows.reverse().map(toChatMessage);
}
