/**
 * ConcursoAI — AuditService (Administration)
 *
 * Auditoria de ações administrativas (docs/05 — AdminActionLog imutável;
 * docs/08 — admin_action_logs; docs/15 §4 — quem, o quê, quando, IP).
 */
import "server-only";
import { AdminActionLogRepository } from "../repositories/admin-action-log.repository";
import { AdminGuardService, type AdminSession } from "./admin-guard.service";

export class AuditError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AuditError";
    this.code = code;
  }
}

export interface RecordAuditInput {
  adminId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: unknown;
  ip?: string | null;
}

export const AuditService = {
  /** Registra uma ação administrativa (imutável). */
  async record(input: RecordAuditInput) {
    return AdminActionLogRepository.create({
      adminId: input.adminId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      details: (input.details ?? null) as never,
      ip: input.ip ?? null,
    });
  },

  /** Lista a auditoria (somente admin). */
  async list(
    admin: AdminSession,
    opts: { entityType?: string; limit?: number } = {}
  ) {
    await AdminGuardService.requireAdmin(admin);
    const limit = opts.limit ?? 50;
    if (opts.entityType) {
      return AdminActionLogRepository.listByEntity(opts.entityType, limit);
    }
    return AdminActionLogRepository.listRecent(limit);
  },
};
