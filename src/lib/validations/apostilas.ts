import { z } from "zod";
import type { StorageRange } from "@/lib/storage/types";

/**
 * Validações de ENTRADA do módulo Apostilas (specs/knowledge-apostilas.md).
 * Mensagens em pt-BR (regra .ai/04 §5).
 */

/** Filtros da listagem "Minhas Apostilas" (query string). */
export const apostilasFilterSchema = z.object({
  materia_id: z.string().uuid("Matéria inválida").optional(),
  concurso: z.string().min(1, "Concurso inválido").max(120).optional(),
  busca: z.string().max(120, "Busca longa demais").optional(),
});

export type ApostilasFilterInput = z.infer<typeof apostilasFilterSchema>;

/** Paramente de rota: /api/apostilas/[id]. */
export const apostilaIdParamSchema = z.object({
  id: z.string().uuid("Identificador de apostila inválido"),
});

/** Lê os filtros da URL ignorando parâmetros vazios ("" significa "ausente"). */
export function parseApostilasFilter(searchParams: URLSearchParams): ApostilasFilterInput {
  const raw: Record<string, string> = {};
  for (const key of ["materia_id", "concurso", "busca"]) {
    const value = searchParams.get(key)?.trim();
    if (value) raw[key] = value;
  }
  return apostilasFilterSchema.parse(raw);
}

/**
 * Parse defensivo do header HTTP Range.
 * - "full": sem Range (ou formato não reconhecido → servimos o ficheiro inteiro).
 * - "range": intervalo válido já limitado ao tamanho real.
 * - "unsatisfiable": início fora do ficheiro (a rota responde 416).
 */
export type ByteRangeResult =
  | { kind: "full" }
  | { kind: "range"; range: StorageRange }
  | { kind: "unsatisfiable"; resource: string };

const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

export function parseByteRange(header: string | null | undefined, size: number): ByteRangeResult {
  const match = header?.trim().match(RANGE_PATTERN);
  if (!match || size <= 0) return { kind: "full" };

  const rawStart = match[1];
  const rawEnd = match[2];
  if (rawStart === "" && rawEnd === "") return { kind: "full" };

  const resource = `bytes */${size}`;

  // Suffix range ("bytes=-200"): últimos N bytes.
  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return { kind: "unsatisfiable", resource };
    const start = Math.max(size - suffix, 0);
    return { kind: "range", range: { start, end: size - 1 } };
  }

  const start = Number(rawStart);
  if (!Number.isFinite(start) || start >= size) return { kind: "unsatisfiable", resource };

  const end = rawEnd === "" ? null : Math.min(Number(rawEnd), size - 1);
  if (end !== null && end < start) return { kind: "unsatisfiable", resource };

  return { kind: "range", range: { start, end } };
}
