/**
 * ConcursoAI — DeepSeekProvider
 *
 * Abstração do provedor de IA (DeepSeek) no nível de domínio.
 * Reutiliza o cliente HTTP existente em `@/lib/ai/deepseek` (sem duplicação).
 */
import "server-only";
import { chatCompletion } from "@/lib/ai/deepseek";
import { KimiService } from "@/lib/ai/kimi";
import { elapsed, logger, now, redactSecrets } from "@/lib/observability";
import type { AIModel, ChatMessage as PromptMessage } from "@/lib/ai/types";

export class ProviderError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}

export interface ProviderRequest {
  model: AIModel;
  messages: PromptMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderResult {
  content: string;
  reasoningContent?: string;
  model: AIModel;
  tokensIn: number;
  tokensOut: number;
}

export const DeepSeekProvider = {
  /**
   * Gera resposta completa (sem streaming) via DeepSeek.
   */
  async complete(req: ProviderRequest): Promise<ProviderResult> {
    const startedAt = now();
    try {
      const result = req.model === "kimi"
        ? await KimiService.complete({
            model: req.model,
            messages: req.messages,
            temperature: req.temperature,
            maxTokens: req.maxTokens,
          })
        : await chatCompletion({
            model: req.model,
            messages: req.messages,
            temperature: req.temperature,
            maxTokens: req.maxTokens,
          });

      logger.info("deepseek", "resposta completada", {
        model: req.model,
        providerTimeMs: elapsed(startedAt),
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      });

      return {
        content: result.content,
        reasoningContent: result.reasoningContent,
        model: result.model,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      };
    } catch (err) {
      // A mensagem crua do provedor pode conter endpoint, chave ou trecho do prompt.
      // Ela e logada redigida e o ProviderError tambem: as rotas de geracao devolvem
      // error.message ao cliente, entao a sanitizacao precisa acontecer aqui.
      const detail = redactSecrets(
        err instanceof Error ? err.message : String(err)
      );
      logger.error("deepseek", "falha na chamada ao provedor", {
        model: req.model,
        error: detail,
      });
      throw new ProviderError("PROVIDER_FAILED", detail);
    }
  },
};
