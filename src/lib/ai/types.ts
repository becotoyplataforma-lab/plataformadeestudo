/**
 * Tipos compartilhados para o módulo de IA.
 */

export type AIModel = "flash" | "pro" | "muse";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: AIModel;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  reasoningContent?: string;
  model: AIModel;
  tokensIn: number;
  tokensOut: number;
}

/** Parâmetros por modelo */
export const MODEL_PARAMS: Record<
  AIModel,
  { temperature: number; maxTokens: number; topP: number }
> = {
  flash: { temperature: 0.5, maxTokens: 2048, topP: 0.9 },
  pro: { temperature: 0.3, maxTokens: 4096, topP: 0.8 },
  muse: { temperature: 0.5, maxTokens: 2048, topP: 0.9 },
};

/** Nomes de modelo no provedor correspondente (DeepSeek / Muse-Meta) */
export const MODEL_NAMES: Record<AIModel, string> = {
  flash: process.env.DEEPSEEK_MODEL_FLASH ?? "deepseek-chat",
  pro: process.env.DEEPSEEK_MODEL_PRO ?? "deepseek-reasoner",
  muse: process.env.MUSE_MODEL ?? "muse-spark-1.2",
};
