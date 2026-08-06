/**
 * ConcursoAI — ModerationService (Administration)
 *
 * Moderação de conteúdo (docs/05 — ModerationService; docs/15 §3.2 — curadoria
 * de questões com status rascunho/publicada/bloqueada). Atua sobre o domínio
 * Study via ModerationRepository (acesso a dados, sem alterar o domínio).
 */
import "server-only";
import {
  ModerationRepository,
  type QuestionStatus,
  type ModerationFilters,
} from "../repositories/moderation.repository";
import { AdminGuardService, type AdminSession } from "./admin-guard.service";
import { AuditService } from "./audit.service";

export class ModerationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ModerationError";
    this.code = code;
  }
}

export const ModerationService = {
  /** Lista questões para curadoria (somente admin). */
  async listQuestions(admin: AdminSession, filters: ModerationFilters = {}) {
    await AdminGuardService.requireAdmin(admin);
    return ModerationRepository.listQuestions(filters);
  },

  /** Altera o status de curadoria de uma questão + auditoria (somente admin). */
  async setStatus(
    admin: AdminSession,
    questionId: string,
    status: QuestionStatus,
    details?: unknown
  ) {
    await AdminGuardService.requireAdmin(admin);
    const existing = await ModerationRepository.findById(questionId);
    if (!existing) {
      throw new ModerationError("QUESTION_NOT_FOUND", "Questão não encontrada.");
    }
    const row = await ModerationRepository.setQuestionStatus(questionId, status);
    await AuditService.record({
      adminId: admin.userId,
      action: `question.${status}`,
      entityType: "question",
      entityId: questionId,
      details,
      ip: admin.ip,
    });
    return row;
  },
};
