import "server-only";
import { env } from "@/lib/env";
import { MODEL_NAMES, MODEL_PARAMS, type ChatCompletionRequest, type ChatCompletionResult } from "@/lib/ai/types";

interface KimiModelsResponse {
  data?: Array<{
    id?: string;
    owned_by?: string;
  }>;
}

function apiKey(): string | undefined {
  return process.env.KIMI_API_KEY?.trim() || env.KIMI_API_KEY?.trim();
}

function modelsUrl(): string {
  return `${env.KIMI_BASE_URL.replace(/\/$/, "")}/models`;
}

export const KimiService = {
  isConfigured(): boolean {
    return Boolean(apiKey());
  },

  async listModels(): Promise<string[]> {
    const key = apiKey();
    if (!key) return [];

    const response = await fetch(modelsUrl(), {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Kimi API erro ${response.status}: ${detail}`);
    }

    const payload = (await response.json()) as KimiModelsResponse;
    return (payload.data ?? [])
      .map((model) => model.id?.trim())
      .filter((id): id is string => Boolean(id))
      .sort((left, right) => left.localeCompare(right));
  },

  async complete(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const key = apiKey();
    if (!key) throw new Error("KIMI_API_KEY não configurada no servidor.");
    const response = await fetch(`${env.KIMI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL_NAMES.kimi,
        messages: req.messages,
        temperature: req.temperature ?? MODEL_PARAMS.kimi.temperature,
        max_tokens: req.maxTokens ?? MODEL_PARAMS.kimi.maxTokens,
        top_p: MODEL_PARAMS.kimi.topP,
        stream: false,
      }),
    });
    if (!response.ok) throw new Error(`Kimi API erro ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      content: payload.choices?.[0]?.message?.content ?? "",
      reasoningContent: payload.choices?.[0]?.message?.reasoning_content,
      model: "kimi",
      tokensIn: payload.usage?.prompt_tokens ?? 0,
      tokensOut: payload.usage?.completion_tokens ?? 0,
    };
  },

  async streamChatCompletion(req: ChatCompletionRequest): Promise<Response> {
    const key = apiKey();
    if (!key) throw new Error("KIMI_API_KEY não configurada no servidor.");
    const response = await fetch(`${env.KIMI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL_NAMES.kimi,
        messages: req.messages,
        temperature: req.temperature ?? MODEL_PARAMS.kimi.temperature,
        max_tokens: req.maxTokens ?? MODEL_PARAMS.kimi.maxTokens,
        top_p: MODEL_PARAMS.kimi.topP,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });
    if (!response.ok) throw new Error(`Kimi API erro ${response.status}: ${(await response.text()).slice(0, 300)}`);
    if (!response.body) throw new Error("Kimi retornou corpo vazio.");
    return response;
  },
};