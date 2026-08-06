import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { sendMessageSchema } from "@/lib/validations/chat";
import { apiError } from "@/lib/api/helpers";
import { prompts, interpolate } from "@/lib/ai/prompts";
import { buildMessages, streamChatCompletion } from "@/lib/ai/deepseek";
import { getAiUsage, registerUsage } from "@/lib/ai/limits";
import {
  createSession,
  getSession,
  getRecentContext,
  insertMessage,
  touchSession,
  updateSessionTitle,
} from "@/lib/db/repositories/chat";
import { getProfile } from "@/lib/db/repositories/perfil";
import type { AIModel, ChatMessage } from "@/lib/ai/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/chat — chat com o Professor IA (streaming SSE).
 */
export async function POST(req: Request) {
  let userId: string;
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");
    userId = session.user.id;
  } catch {
    return apiError(401, "Não autenticado.");
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = sendMessageSchema.safeParse(body);
  } catch {
    return apiError(400, "Corpo inválido.");
  }

  if (!parsed.success) {
    return apiError(422, parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  const { session_id, message, model, subject_id } = parsed.data;

  const db = await createClient();

  // --- Cotas de IA ---
  const usage = await getAiUsage(userId);
  if (!usage.canSend) {
    return apiError(
      429,
      "Você atingiu o limite diário de mensagens do seu plano. Volte amanhã ou faça upgrade."
    );
  }

  // --- Sessão de chat ---
  let activeSessionId = session_id ?? null;
  if (activeSessionId) {
    const existing = await getSession(db, userId, activeSessionId);
    if (!existing) activeSessionId = null;
  }
  if (!activeSessionId) {
    const created = await createSession(db, userId, {
      title: message.slice(0, 60),
      subject_id,
      model,
    });
    activeSessionId = created.id;
  } else {
    await touchSession(db, userId, activeSessionId);
  }

  // --- Perfil + contexto ---
  const profile = await getProfile(db, userId);
  const history = await getRecentContext(db, userId, activeSessionId, 10);

  const systemTemplate = await prompts.professorSystem();
  const systemPrompt = interpolate(systemTemplate, {
    nome_usuario: profile?.full_name ?? "Aluno",
    nivel: profile?.nivel ?? "iniciante",
    disciplina: subject_id ? "específica" : "geral",
    banca: profile?.banca_preferida ?? "diversas",
    cargo: profile?.concurso_alvo ?? "concurso público",
    contexto_rag: "",
  });

  const historyMessages: ChatMessage[] = history.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const messages = buildMessages(systemPrompt, historyMessages, message);

  // --- Salva mensagem do usuário ---
  await insertMessage(db, {
    session_id: activeSessionId,
    user_id: userId,
    role: "user",
    content: message,
    model,
  });

  // --- Stream da DeepSeek ---
  let upstream: Response;
  try {
    upstream = await streamChatCompletion({ model: model as AIModel, messages, stream: true });
  } catch (err) {
    console.error("[chat] DeepSeek falhou:", err);
    return apiError(
      502,
      "Não foi possível contatar o Professor IA no momento. Tente novamente."
    );
  }

  if (!upstream.body) {
    return apiError(502, "Resposta vazia do provedor.");
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let fullText = "";
  let fullReasoning = "";
  let tokensIn = 0;
  let tokensOut = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // envia o id da sessão para o cliente
      sendEvent("start", { session_id: activeSessionId });

      const reader = upstream.body!.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            if (line.startsWith("data:")) {
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const json = JSON.parse(payload);
                const delta = json.choices?.[0]?.delta;
                if (delta?.reasoning_content) {
                  fullReasoning += delta.reasoning_content;
                  sendEvent("reasoning", { text: delta.reasoning_content });
                }
                if (delta?.content) {
                  fullText += delta.content;
                  sendEvent("delta", { text: delta.content });
                }
                if (json.usage) {
                  tokensIn = json.usage.prompt_tokens ?? 0;
                  tokensOut = json.usage.completion_tokens ?? 0;
                }
              } catch {
                // ignora chunks inválidos
              }
            }
          }
        }
      } catch (err) {
        console.error("[chat] Erro no stream:", err);
        sendEvent("error", { message: "Erro durante a geração." });
      } finally {
        // Salva resposta final no banco
        try {
          const finalContent = fullText || "⚠️ Desculpe, não consegui gerar uma resposta. Tente novamente.";
          await insertMessage(db, {
            session_id: activeSessionId,
            user_id: userId,
            role: "assistant",
            content: finalContent,
            model: model as AIModel,
            tokens_in: tokensIn,
            tokens_out: tokensOut,
          });
          if (tokensIn > 0 || tokensOut > 0) {
            await registerUsage(userId, tokensIn, tokensOut);
          }
          // Atualiza título da 1ª mensagem se ainda for genérico
          const sessions = await db
            .from("chat_sessions")
            .select("title")
            .eq("id", activeSessionId)
            .single();
          if (sessions.data?.title === "Nova conversa") {
            await updateSessionTitle(db, userId, activeSessionId, message.slice(0, 60) || "Nova conversa");
          }
        } catch (err) {
          console.error("[chat] Falha ao salvar resposta:", err);
        }

        sendEvent("done", { tokens_in: tokensIn, tokens_out: tokensOut, model });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
