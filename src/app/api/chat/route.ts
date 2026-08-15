import { auth } from "@/lib/auth/auth";
import { sendMessageSchema } from "@/lib/validations/chat";
import { apiError } from "@/lib/api/helpers";
import { prompts, interpolate } from "@/lib/ai/prompts";
import { buildMessages, streamChatCompletion } from "@/lib/ai/deepseek";
import { getAiUsage, registerUsage } from "@/lib/ai/limits";
import { resolveUserLimits } from "@/lib/billing/services/limits.resolver";
import {
  createSession,
  getSession,
  getRecentContext,
  insertMessage,
  touchSession,
  updateSessionTitle,
} from "@/lib/db/repositories/chat";
import { getProfile } from "@/lib/db/repositories/perfil";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentChunkRepository } from "@/lib/knowledge/repositories/chunk.repository";
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

  const { session_id, message, model, subject_id, document_id } = parsed.data;

  // --- Cotas de IA (limites resolvidos pelo Billing — OPEN-004) ---
  const usage = await getAiUsage(userId, await resolveUserLimits(userId));
  if (!usage.canSend) {
    return apiError(
      429,
      "Você atingiu o limite diário de mensagens. Tente novamente amanhã."
    );
  }

  // --- Sessão de chat ---
  let activeSessionId = session_id ?? null;
  if (activeSessionId) {
    const existing = await getSession(userId, activeSessionId);
    if (!existing) activeSessionId = null;
  }
  if (!activeSessionId) {
    const created = await createSession(userId, {
      title: message.slice(0, 60),
      subject_id,
      model,
    });
    activeSessionId = created.id;
  } else {
    await touchSession(userId, activeSessionId);
  }

  // --- Perfil + contexto ---
  const profile = await getProfile(userId);
  const history = await getRecentContext(userId, activeSessionId, 10);

  // RAG: se o aluno escolheu uma apostila, injeta o conteúdo como contexto.
  let contextoRag = "";
  if (document_id) {
    const doc = await DocumentRepository.findById(document_id).catch(() => null);
    if (doc && doc.userId === userId) {
      const chunks = await DocumentChunkRepository.listByDocument(document_id).catch(() => []);
      if (chunks.length > 0) {
        contextoRag = `Conteúdo da apostila "${doc.title}":\n${chunks
          .map((c) => c.content ?? "")
          .join("\n\n")
          .slice(0, 6000)}`;
      }
    }
  }

  const systemTemplate = await prompts.professorSystem();
  const systemPrompt = interpolate(systemTemplate, {
    nome_usuario: profile?.full_name ?? "Aluno",
    nivel: profile?.nivel ?? "iniciante",
    disciplina: subject_id ? "específica" : "geral",
    banca: profile?.banca_preferida ?? "diversas",
    cargo: profile?.concurso_alvo ?? "concurso público",
    contexto_rag: contextoRag,
  });

  const historyMessages: ChatMessage[] = history.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const messages = buildMessages(systemPrompt, historyMessages, message);

  // --- Salva mensagem do usuário ---
  await insertMessage({
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
          await insertMessage({
            session_id: activeSessionId,
            user_id: userId,
            role: "assistant",
            content: finalContent,
            model,
            tokens_in: tokensIn,
            tokens_out: tokensOut,
          });
          if (tokensIn > 0 || tokensOut > 0) {
            await registerUsage(userId, tokensIn, tokensOut);
          }
          // Atualiza título da 1ª mensagem se ainda for genérico
          const current = await getSession(userId, activeSessionId);
          if (current?.title === "Nova conversa") {
            await updateSessionTitle(userId, activeSessionId, message.slice(0, 60) || "Nova conversa");
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
