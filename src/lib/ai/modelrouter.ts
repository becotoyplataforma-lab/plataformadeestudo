import "server-only";
import { env } from "@/lib/env";
import { redactSecrets } from "@/lib/observability";
import {
  MODEL_NAMES,
  MODEL_PARAMS,
  type ChatCompletionRequest,
  type ChatCompletionResult,
} from "@/lib/ai/types";

/**
 * Cliente ModelRouter (gateway compatível com a API OpenAI).
 * USO EXCLUSIVO EM SERVIDOR.
 *
 * A chave NUNCA é exposta ao cliente: lida apenas de variáveis de ambiente
 * (MODELROUTER_API_KEY / MODELROUTER_BASE_URL).
 */

interface ModelRouterModelsResponse {
  data?: Array<{
    id?: string;
    owned_by?: string;
  }>;
}

interface ModelRouterChatResponse {
  choices?: Array<{
    message?: { content?: string; reasoning_content?: string };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Lê a chave do ambiente (process.env tem prioridade sobre o schema). */
function apiKey(): string | undefined {
  return process.env.MODELROUTER_API_KEY?.trim() || env.MODELROUTER_API_KEY?.trim();
}

/** URL base sem barra final. */
function baseUrl(): string {
  return env.MODELROUTER_BASE_URL.replace(/\/$/, "");
}

/**
 * Erro do gateway, sempre redigido.
 *
 * O corpo devolvido pelo ModelRouter é texto não confirmado: pode trazer a
 * própria chave, um JWT do upstream ou um header de autorização copiado para
 * dentro da mensagem. As rotas de administração devolvem `error.message` ao
 * utilizador, por isso a sanitização tem de acontecer aqui, na origem.
 *
 * A redação ocorre ANTES do truncamento de caso pensado: fatiar primeiro pode
 * partir o JWT ao meio, e `JWT_LIKE` exige os três segmentos para casar. Um
 * segredo truncado sobreviveria ao filtro exatamente por ter sido cortado.
 */
function gatewayError(status: number, body: string): Error {
  return new Error(
    `ModelRouter API erro ${status}: ${redactSecrets(body).slice(0, 300)}`
  );
}

export const ModelRouterClient = {
  /** Indica se a chave está configurada (sem revelar o valor). */
  isConfigured(): boolean {
    return Boolean(apiKey());
  },

  /** Lista os modelos disponíveis no gateway. */
  async listModels(): Promise<string[]> {
    const key = apiKey();
    if (!key) return [];

    const response = await fetch(`${baseUrl()}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!response.ok) {
      throw gatewayError(response.status, await response.text());
    }

    const payload = (await response.json()) as ModelRouterModelsResponse;
    return (payload.data ?? [])
      .map((model) => model.id?.trim())
      .filter((id): id is string => Boolean(id))
      .sort((left, right) => left.localeCompare(right));
  },

  /** Gera uma resposta completa (sem streaming). */
  async complete(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const key = apiKey();
    if (!key) throw new Error("MODELROUTER_API_KEY não configurada no servidor.");
    const params = MODEL_PARAMS[req.model];

    const response = await fetch(`${baseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL_NAMES[req.model],
        messages: req.messages,
        temperature: req.temperature ?? params.temperature,
        max_tokens: req.maxTokens ?? params.maxTokens,
        top_p: params.topP,
        stream: false,
      }),
    });
    if (!response.ok) {
      throw gatewayError(response.status, await response.text());
    }

    const payload = (await response.json()) as ModelRouterChatResponse;
    return {
      content: payload.choices?.[0]?.message?.content ?? "",
      reasoningContent: payload.choices?.[0]?.message?.reasoning_content,
      model: req.model,
      tokensIn: payload.usage?.prompt_tokens ?? 0,
      tokensOut: payload.usage?.completion_tokens ?? 0,
    };
  },

  /** Cliente streaming (Web Streams). */
  async streamChatCompletion(req: ChatCompletionRequest): Promise<Response> {
    const key = apiKey();
    if (!key) throw new Error("MODELROUTER_API_KEY não configurada no servidor.");
    const params = MODEL_PARAMS[req.model];

    const response = await fetch(`${baseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL_NAMES[req.model],
        messages: req.messages,
        temperature: req.temperature ?? params.temperature,
        max_tokens: req.maxTokens ?? params.maxTokens,
        top_p: params.topP,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });
    if (!response.ok) {
      throw gatewayError(response.status, await response.text());
    }
    if (!response.body) throw new Error("ModelRouter retornou corpo vazio.");
    return response;
  },
};
