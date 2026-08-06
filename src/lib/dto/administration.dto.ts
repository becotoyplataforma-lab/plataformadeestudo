/**
 * ConcursoAI — Administration DTOs
 *
 * Data Transfer Objects do domínio Administration.
 * Segue: DD-006 (DTO obrigatório), DD-007 (Zod obrigatório),
 *        docs/08-DATABASE-PHYSICAL.md (system_settings, admin_action_logs)
 */
import { z } from "zod";
import type { OutputOf } from "@/lib/dto";
import type { systemSettings, adminActionLogs } from "@/db/schema/administration";

// ============================================================
// SystemSetting
// ============================================================

export const SystemSettingDtoSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  description: z.string().nullable(),
  updated_at: z.string(),
});
export type SystemSettingDto = OutputOf<typeof SystemSettingDtoSchema>;

export const SystemSettingListDtoSchema = z.object({
  data: z.array(SystemSettingDtoSchema),
});
export type SystemSettingListDto = OutputOf<typeof SystemSettingListDtoSchema>;

export const SetSettingRequestDtoSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
  description: z.string().max(500).optional(),
});
export type SetSettingRequestDto = OutputOf<typeof SetSettingRequestDtoSchema>;

// ============================================================
// AdminActionLog
// ============================================================

export const AdminActionLogDtoSchema = z.object({
  id: z.string().uuid(),
  admin_id: z.string().uuid().nullable(),
  action: z.string().min(1),
  entity_type: z.string().min(1),
  entity_id: z.string().uuid().nullable(),
  details: z.unknown().nullable(),
  ip: z.string().nullable(),
  created_at: z.string(),
});
export type AdminActionLogDto = OutputOf<typeof AdminActionLogDtoSchema>;

export const AdminActionLogListDtoSchema = z.object({
  data: z.array(AdminActionLogDtoSchema),
});
export type AdminActionLogListDto = OutputOf<typeof AdminActionLogListDtoSchema>;

// ============================================================
// Moderation (questões)
// ============================================================

export const ModerationQuestionDtoSchema = z.object({
  id: z.string().uuid(),
  subject_id: z.string().uuid().nullable(),
  subject_name: z.string().nullable(),
  banca: z.string().nullable(),
  ano: z.number().int().nullable(),
  nivel: z.enum(["facil", "medio", "dificil"]),
  enunciado: z.string(),
  status: z.enum(["rascunho", "publicada", "bloqueada"]),
  is_public: z.boolean(),
  created_at: z.string(),
});
export type ModerationQuestionDto = OutputOf<typeof ModerationQuestionDtoSchema>;

export const ModerationListDtoSchema = z.object({
  data: z.array(ModerationQuestionDtoSchema),
  total: z.number().int().nonnegative(),
});
export type ModerationListDto = OutputOf<typeof ModerationListDtoSchema>;

export const SetQuestionStatusRequestDtoSchema = z.object({
  status: z.enum(["rascunho", "publicada", "bloqueada"]),
});
export type SetQuestionStatusRequestDto = OutputOf<
  typeof SetQuestionStatusRequestDtoSchema
>;

export const QuestionStatusDtoSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["rascunho", "publicada", "bloqueada"]),
});
export type QuestionStatusDto = OutputOf<typeof QuestionStatusDtoSchema>;

// ============================================================
// Mappers
// ============================================================

type SystemSettingRow = typeof systemSettings.$inferSelect;
type AdminActionLogRow = typeof adminActionLogs.$inferSelect;

export function mapSystemSettingToDto(row: SystemSettingRow): SystemSettingDto {
  return {
    key: row.key,
    value: row.value,
    description: row.description,
    updated_at: row.updatedAt.toISOString(),
  };
}

export function mapAdminActionLogToDto(row: AdminActionLogRow): AdminActionLogDto {
  return {
    id: row.id,
    admin_id: row.adminId,
    action: row.action,
    entity_type: row.entityType,
    entity_id: row.entityId,
    details: row.details,
    ip: row.ip,
    created_at: row.createdAt.toISOString(),
  };
}

export interface ModerationQuestionInput {
  id: string;
  subjectId: string | null;
  subjectName: string | null;
  banca: string | null;
  ano: number | null;
  nivel: "facil" | "medio" | "dificil";
  enunciado: string;
  status: "rascunho" | "publicada" | "bloqueada";
  isPublic: boolean;
  createdAt: Date;
}

export function mapModerationQuestionToDto(
  q: ModerationQuestionInput
): ModerationQuestionDto {
  return {
    id: q.id,
    subject_id: q.subjectId,
    subject_name: q.subjectName,
    banca: q.banca,
    ano: q.ano,
    nivel: q.nivel,
    enunciado: q.enunciado,
    status: q.status,
    is_public: q.isPublic,
    created_at: q.createdAt.toISOString(),
  };
}

export function mapQuestionStatusToDto(row: {
  id: string;
  status: "rascunho" | "publicada" | "bloqueada";
}): QuestionStatusDto {
  return { id: row.id, status: row.status };
}
