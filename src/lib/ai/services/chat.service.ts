/**
 * ConcursoAI — ChatService
 *
 * Orquestra o fluxo de chat: sessão → prompt → provider → persistência → usage.
 * Sem RAG, sem busca vetorial (MVP).
 */
import "server-only";
import { ChatRepository } from "../repositories/chat.repository";
import { PromptService } from "./prompt.service";
import { ModelRouterService } from "./model-router.service";
import { DeepSeekProvider } from "./deepseek-provider.service";
import { UsageService } from "./usage.service";
import type { AIModel } from "@/lib/ai/types";

export class ChatError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ChatError";
    this.code = code;
  }
}

export interface ChatInput {
  userId: string;
  message: string;
  sessionId?: string;
  subjectId?: string;
  model?: AIModel;
}

export interface ChatResult {
  sessionId: string;
  messageId: string;
  response: string;
  model: AIModel;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  costBRL: number;
  latencyMs: number;
}

export const ChatService = {
  /**
   * Enviar mensagem ao Professor IA (fluxo completo).
   */
  async send(input: ChatInput): Promise<ChatResult> {
    const startedAt = Date.now();
    const { userId, message } = input;

    // 1. Resolver/validar sessão
    let session = input.sessionId
      ? await ChatRepository.findSessionById(input.sessionId, userId)
      : null;

    if (input.sessionId && !session) {
      throw new ChatError("SESSION_NOT_FOUND", "Conversa não encontrada.");
    }

    if (!session) {
      session = await ChatRepository.createSession({
        userId,
        title: message.slice(0, 60),
        knowledgeSubjectId: input.subjectId ?? null,
        model: "flash",
      });
    } else {
      // Mantém o modelo da sessão se não foi solicitado
      await ChatRepository.touchSession(session.id, userId);
    }

    // 2. Roteia modelo
    const model = ModelRouterService.route({
      requested: input.model ?? session.model,
    });

    // 3. Persiste mensagem do usuário
    await ChatRepository.createMessage({
      sessionId: session.id,
      userId,
      role: "user",
      content: message,
      model,
      tokensIn: 0,
      tokensOut: 0,
    });

    // 4. Monta prompt (system + histórico + user)
    const systemPrompt = await PromptService.buildSystemPrompt();
    const recent = await ChatRepository.getRecentContext(session.id, 10);
    const history = recent
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      .slice(0, 9); // mantém a última para o buildMessages (que insere a user)

    const messages = await PromptService.buildMessages(
      systemPrompt,
      history,
      message
    );

    // 5. Chama provedor
    const providerResult = await DeepSeekProvider.complete({ model, messages });

    // 6. Persiste resposta do assistente
    const assistantMsg = await ChatRepository.createMessage({
      sessionId: session.id,
      userId,
      role: "assistant",
      content: providerResult.content,
      model: providerResult.model,
      tokensIn: providerResult.tokensIn,
      tokensOut: providerResult.tokensOut,
    });

    // 7. Registra uso
    await UsageService.record(
      userId,
      providerResult.tokensIn,
      providerResult.tokensOut
    );

    const latencyMs = Date.now() - startedAt;

    return {
      sessionId: session.id,
      messageId: assistantMsg.id,
      response: providerResult.content,
      model: providerResult.model,
      tokensIn: providerResult.tokensIn,
      tokensOut: providerResult.tokensOut,
      totalTokens: providerResult.tokensIn + providerResult.tokensOut,
      costBRL: UsageService.estimateCost(
        providerResult.model,
        providerResult.tokensIn,
        providerResult.tokensOut
      ),
      latencyMs,
    };
  },
};
