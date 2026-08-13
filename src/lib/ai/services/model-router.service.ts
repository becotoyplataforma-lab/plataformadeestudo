/**
 * ConcursoAI — ModelRouterService
 *
 * Roteamento entre modelos (flash/pro) com base na requisição.
 * Flash: rápido/barato (default). Pro: raciocínio profundo.
 */
import type { AIModel } from "@/lib/ai/types";

export class ModelRouterError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ModelRouterError";
    this.code = code;
  }
}

export interface RouterContext {
  requested?: AIModel;
  isComplex?: boolean;
}

export const ModelRouterService = {
  /**
   * Decide o modelo a usar.
   * - Se explícito na requisição, respeita (flash/pro).
   * - Caso contrário, usa flash (default MVP).
   */
  route(ctx: RouterContext = {}): AIModel {
    if (ctx.requested) {
      if (ctx.requested !== "flash" && ctx.requested !== "pro") {
        throw new ModelRouterError(
          "INVALID_MODEL",
          "Modelo inválido. Use flash ou pro."
        );
      }
      return ctx.requested;
    }
    // Heurística simples: se marcado como complexo, promove para pro.
    if (ctx.isComplex) return "pro";
    return "flash";
  },
};
