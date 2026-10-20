import { z } from "zod";

/**
 * Validações de ENTRADA do agregado Document (Knowledge Core).
 * Mensagens em pt-BR (regra .ai/04 §5).
 */

/** Paramente de rota: /api/knowledge/documents/[id]. */
export const documentIdParamSchema = z.object({
  id: z.string().uuid("Identificador de documento inválido"),
});
