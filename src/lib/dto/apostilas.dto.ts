/**
 * ConcursoAI — Apostilas DTOs
 *
 * Contrato de fronteira do módulo "Minhas Apostilas" (Fase 1).
 * Nunca expõe `storage_path`: o acesso ao binário é sempre feito pela rota
 * autenticada `/api/apostilas/[id]/arquivo` (regra .ai/08 + specs/knowledge-apostilas.md).
 *
 * Segue: .ai/DTO-GUIDELINES.md (schema de saída + OutputOf + mapper)
 */
import { z } from "zod";
import { parseDto, strictDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";

// ============================================================
// Linha agregada vinda do Repository (documents × document_subjects × knowledge_subjects)
// ============================================================

/** Valida a forma da linha ANTES de mapear (defensivo a mudanças de schema). */
export const apostilaRowSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum(["pdf", "docx", "txt", "markdown", "html", "edital", "apostila"]),
  title: z.string(),
  storagePath: z.string().min(1),
  status: z.enum([
    "pending",
    "processing",
    "processed",
    "chunked",
    "indexing",
    "indexed",
    "failed",
  ]),
  fileSize: z.number().int().nonnegative().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.coerce.date(),
  subjectId: z.string().uuid().nullable().optional(),
  subjectName: z.string().nullable().optional(),
  subjectColor: z.string().nullable().optional(),
});

export type ApostilaRow = OutputOf<typeof apostilaRowSchema>;

/** Tipo de conteúdo (JSONB `metadata` → nível de concurso/trilha). */
const CONCURSO_METADATA_KEYS = ["concurso", "trilha"] as const;

function extractConcurso(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  for (const key of CONCURSO_METADATA_KEYS) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

/** URL do proxy autenticado — o único caminho que o cliente conhece. */
export function apostilaArquivoUrl(id: string): string {
  return `/api/apostilas/${id}/arquivo`;
}

// ============================================================
// Apostila DTO (uma apostila)
// ============================================================

export const ApostilaDtoSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string(),
  tipo: z.enum(["pdf", "docx", "txt", "markdown", "html", "edital", "apostila"]),
  status: z.enum([
    "pending",
    "processing",
    "processed",
    "chunked",
    "indexing",
    "indexed",
    "failed",
  ]),
  tamanho_bytes: z.number().int().nonnegative().nullable(),
  mime_type: z.string().nullable(),
  concurso: z.string().nullable(),
  materia_id: z.string().uuid().nullable(),
  materia_nome: z.string().nullable(),
  materia_cor: z.string().nullable(),
  /** Rota autenticada (nunca storage_path nem URL do bucket). */
  arquivo_url: z.string(),
  pdf_url: z.string().optional(),
  download_url: z.string().optional(),
  criado_em: z.string(),
});

export type ApostilaDto = OutputOf<typeof ApostilaDtoSchema>;

/** Mapper: linha do banco → DTO (remove campos sensíveis, normaliza pt-BR). */
export function toApostilaDto(row: unknown): ApostilaDto | null {
  const parsed = apostilaRowSchema.safeParse(row);
  if (!parsed.success) {
    console.error(
      "[dto] linha de apostila inválida:",
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ")
    );
    return null;
  }

  const source = parsed.data;
  return parseDto(ApostilaDtoSchema, {
    id: source.id,
    titulo: source.title,
    tipo: source.type,
    status: source.status,
    tamanho_bytes: source.fileSize ?? null,
    mime_type: source.mimeType ?? null,
    concurso: extractConcurso(source.metadata),
    materia_id: source.subjectId ?? null,
    materia_nome: source.subjectName ?? null,
    materia_cor: source.subjectColor ?? null,
    arquivo_url: apostilaArquivoUrl(source.id),
    pdf_url: `/api/apostilas/${source.id}/download`,
    download_url: `/api/apostilas/${source.id}/download`,
    criado_em: source.createdAt.toISOString(),
  });
}

/** Mapper fail-fast para o caso em que a linha DEVE conformar. */
export function toApostilaDtoStrict(row: unknown): ApostilaDto {
  const dto = toApostilaDto(row);
  if (!dto) {
    throw new Error("[dto] linha de apostila não conforme ao ApostilaDto.");
  }
  return dto;
}

export function toApostilaDtoList(rows: unknown[]): ApostilaDto[] {
  return rows
    .map((row) => toApostilaDto(row))
    .filter((dto): dto is ApostilaDto => dto !== null);
}

// ============================================================
// Agrupamento por matéria (hierarquia Concurso → Matéria → Apostila)
// ============================================================

/** Chave do grupo de apostilas sem matéria classificada. */
export const SEM_MATERIA_ID = "sem-materia";
export const SEM_MATERIA_NOME = "Sem matéria";

export const MateriaApostilasDtoSchema = z.object({
  /** uuid da matéria (knowledge_subjects) ou SEM_MATERIA_ID. */
  materia_id: z.string(),
  materia_nome: z.string(),
  materia_cor: z.string().nullable(),
  total: z.number().int().nonnegative(),
  apostilas: z.array(ApostilaDtoSchema),
});

export type MateriaApostilasDto = OutputOf<typeof MateriaApostilasDtoSchema>;

export const ApostilasListaDtoSchema = z.object({
  usuario_id: z.string().uuid(),
  total_apostilas: z.number().int().nonnegative(),
  total_materias: z.number().int().nonnegative(),
  /** Concursos/trilhas presentes (extraídos do metadata das apostilas). */
  concursos: z.array(z.string()),
  materias: z.array(MateriaApostilasDtoSchema),
});

export type ApostilasListaDto = OutputOf<typeof ApostilasListaDtoSchema>;

export function toMateriaApostilasDto(input: unknown): MateriaApostilasDto | null {
  return parseDto(MateriaApostilasDtoSchema, input);
}

export function toApostilasListaDto(input: unknown): ApostilasListaDto | null {
  return parseDto(ApostilasListaDtoSchema, input);
}

/** Fail-fast na fronteira: a lista DEVE conformar ao contrato. */
export function toApostilasListaDtoStrict(input: unknown): ApostilasListaDto {
  return strictDto(ApostilasListaDtoSchema, input);
}
