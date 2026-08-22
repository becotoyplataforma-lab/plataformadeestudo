import "server-only";
import { env } from "@/lib/env";
import {
  MODEL_NAMES,
  MODEL_PARAMS,
  type ChatCompletionRequest,
  type ChatCompletionResult,
  type ChatMessage,
} from "@/lib/ai/types";

/**
 * Cliente DeepSeek (compatível com a API OpenAI).
 * USO EXCLUSIVO EM SERVIDOR.
 *
 * Models:
 * - flash → deepseek-chat (rápido/barato)
 * - pro   → deepseek-reasoner (raciocínio profundo)
 */

interface DeepSeekChatResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      reasoning_content?: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface DeepSeekStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
      reasoning_content?: string;
    };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

function apiUrl() {
  return `${env.DEEPSEEK_BASE_URL.replace(/\/$/, "")}/chat/completions`;
}

function apiKey() {
  return process.env.DEEPSEEK_API_KEY?.trim() || env.DEEPSEEK_API_KEY;
}

async function postJson<T>(body: unknown, signal?: AbortSignal): Promise<T> {
  const key = apiKey();
  if (!key) {
    throw new Error("DEEPSEEK_API_KEY não configurada no servidor.");
  }
  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `DeepSeek API erro ${res.status}: ${text.slice(0, 500)}`
    );
  }
  return res.json() as Promise<T>;
}

/** Gera uma resposta completa (sem streaming). */
export async function chatCompletion(
  req: ChatCompletionRequest,
  signal?: AbortSignal
): Promise<ChatCompletionResult> {
  const params = MODEL_PARAMS[req.model];
  const data = await postJson<DeepSeekChatResponse>(
    {
      model: MODEL_NAMES[req.model],
      messages: req.messages,
      temperature: req.temperature ?? params.temperature,
      max_tokens: req.maxTokens ?? params.maxTokens,
      top_p: params.topP,
      stream: false,
    },
    signal
  );

  const choice = data.choices[0];
  return {
    content: choice?.message?.content ?? "",
    reasoningContent: choice?.message?.reasoning_content,
    model: req.model,
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
  };
}

/** Cliente streaming (Web Streams) — usado pela API route /api/chat. */
export async function streamChatCompletion(
  req: ChatCompletionRequest,
  signal?: AbortSignal
): Promise<Response> {
  const key = apiKey();
  if (!key) {
    throw new Error("DEEPSEEK_API_KEY não configurada no servidor.");
  }
  const params = MODEL_PARAMS[req.model];

  const upstream = await fetch(apiUrl(), {
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
    signal,
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    throw new Error(`DeepSeek API erro ${upstream.status}: ${text.slice(0, 500)}`);
  }
  if (!upstream.body) {
    throw new Error("DeepSeek retornou corpo vazio.");
  }

  return upstream;
}

/** Parser de chunks SSE da DeepSeek em um callback de delta. */
export function parseStreamChunk(
  raw: string,
  onDelta: (text: string) => void,
  onReasoning: (text: string) => void
): { done: boolean; usage?: { prompt_tokens: number; completion_tokens: number } } {
  const dataLine = raw.trim();
  if (!dataLine.startsWith("data:")) return { done: false };
  const payload = dataLine.slice(5).trim();
  if (payload === "[DONE]") return { done: true };

  try {
    const json = JSON.parse(payload) as DeepSeekStreamChunk;
    const delta = json.choices?.[0]?.delta;
    if (delta?.reasoning_content) onReasoning(delta.reasoning_content);
    if (delta?.content) onDelta(delta.content);
    return { done: json.choices?.[0]?.finish_reason === "stop", usage: json.usage };
  } catch {
    return { done: false };
  }
}

/** Constrói um system prompt com placeholders substituídos. */
export function buildMessages(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string
): ChatMessage[] {
  const msgs: ChatMessage[] = [{ role: "system", content: systemPrompt }];
  // Histórico (já contém mensagens user/assistant anteriores)
  msgs.push(...history);
  msgs.push({ role: "user", content: userMessage });
  return msgs;
}
