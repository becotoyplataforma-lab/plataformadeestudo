import { z } from "zod";

/**
 * Infraestrutura de DTOs (Data Transfer Objects).
 *
 * DTOs definem o contrato de dados nas FRONTEIRAS do sistema
 * (API routes e Server Actions) — o que entra e o que sai.
 *
 * - Sempre validar saída com um schema Zod (regra: "Sempre utilizar DTO").
 * - DTO ≠ tipo de domínio (`src/types`) ≠ linha do banco.
 * - DTOs removem campos sensíveis e normalizam o formato (JSON snake_case).
 *
 * Uso em novas funcionalidades:
 *   const dto = strictDto(StudyTaskDtoSchema, row); // falha se não conformar
 *   const dto = parseDto(StudyTaskDtoSchema, row);  // null se inválido (log)
 */

/** Valida `input` contra o schema; retorna o DTO tipado ou `null` (logando). */
export function parseDto<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown
): z.infer<T> | null {
  const result = schema.safeParse(input);
  if (!result.success) {
    console.error(
      "[dto] validação falhou:",
      result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ")
    );
    return null;
  }
  return result.data;
}

/** Como `parseDto`, mas LANÇA se o dado não conformar (fail-fast no servidor). */
export function strictDto<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown
): z.infer<T> {
  const dto = parseDto(schema, input);
  if (!dto) {
    throw new Error("[dto] dados não conformes ao DTO definido.");
  }
  return dto;
}

/** Type guard: verifica se `input` é um DTO válido. */
export function isDto<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown
): input is z.infer<T> {
  return schema.safeParse(input).success;
}

/** Tipo utilitário: infere o tipo de saída de um schema Zod (o DTO). */
export type OutputOf<T extends z.ZodTypeAny> = z.infer<T>;

/** Seleciona campos de um objeto (util para construir DTOs sem campos sensíveis). */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) out[key] = obj[key];
  return out;
}

/** Omit sensíveis de um objeto (whitelist inversa). */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Omit<T, K> {
  const out = { ...obj } as Omit<T, K>;
  for (const key of keys) delete (out as Record<string, unknown>)[key as string];
  return out;
}
