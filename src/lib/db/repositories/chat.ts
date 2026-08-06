import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, ChatSession } from "@/types";

type DB = SupabaseClient;

/** Lista sessões de conversa do usuário */
export async function listSessions(db: DB, userId: string): Promise<ChatSession[]> {
  const { data, error } = await db
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ChatSession[]) ?? [];
}

export async function getSession(
  db: DB,
  userId: string,
  sessionId: string
): Promise<ChatSession | null> {
  const { data, error } = await db
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data as ChatSession;
}

export async function createSession(
  db: DB,
  userId: string,
  input: { title?: string; subject_id?: string | null; model?: "flash" | "pro" }
): Promise<ChatSession> {
  const { data, error } = await db
    .from("chat_sessions")
    .insert({
      user_id: userId,
      title: input.title ?? "Nova conversa",
      subject_id: input.subject_id ?? null,
      model: input.model ?? "flash",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ChatSession;
}

export async function updateSessionTitle(
  db: DB,
  userId: string,
  sessionId: string,
  title: string
): Promise<void> {
  await db
    .from("chat_sessions")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);
}

export async function touchSession(db: DB, userId: string, sessionId: string): Promise<void> {
  await db
    .from("chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);
}

export async function deleteSession(db: DB, userId: string, sessionId: string): Promise<void> {
  const { error } = await db
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Histórico de mensagens de uma sessão (crescente) */
export async function listMessages(
  db: DB,
  userId: string,
  sessionId: string
): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ChatMessage[]) ?? [];
}

export async function insertMessage(
  db: DB,
  msg: {
    session_id: string;
    user_id: string;
    role: "system" | "user" | "assistant";
    content: string;
    model?: "flash" | "pro" | null;
    tokens_in?: number;
    tokens_out?: number;
  }
): Promise<ChatMessage> {
  const { data, error } = await db
    .from("chat_messages")
    .insert(msg)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ChatMessage;
}

/** Últimas N mensagens para montar contexto do LLM (janela deslizante) */
export async function getRecentContext(
  db: DB,
  userId: string,
  sessionId: string,
  limit = 10
): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data as ChatMessage[]) ?? []).reverse();
}
