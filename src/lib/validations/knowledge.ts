import { z } from "zod";

/**
 * Validacoes de entrada do Knowledge Engine.
 *
 * Mantem a rota de upload livre de regras de conteudo: aqui so entra a forma do
 * pedido (qual provedor MCP, flags de processamento).
 */
export const mcpProviderIdSchema = z
  .string()
  .trim()
  .min(1, "Selecione um MCP de processamento.")
  .max(64, "Identificador de MCP muito longo.")
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Identificador de MCP invalido.");

export const mcpSelectionSchema = z.object({
  mcp_provider_id: mcpProviderIdSchema.optional(),
});

export const mcpReprocessSchema = z.object({
  mcp_provider_id: mcpProviderIdSchema.optional(),
});

export type McpSelectionInput = z.infer<typeof mcpSelectionSchema>;
export type McpReprocessInput = z.infer<typeof mcpReprocessSchema>;

export type McpFieldResult =
  | { ok: true; id?: string }
  | { ok: false; message: string };

/**
 * Le o campo mcp_provider_id vindo de FormData.
 * Ausente ou vazio significa "usar o provedor padrao"; valor malformed vira
 * mensagem segura, nunca excecao crua do zod.
 */
export function readMcpProviderId(raw: FormDataEntryValue | null): McpFieldResult {
  if (raw === null) return { ok: true };
  if (typeof raw !== "string" || raw.trim().length === 0) return { ok: true };
  const parsed = mcpProviderIdSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "MCP invalido." };
  }
  return { ok: true, id: parsed.data };
}