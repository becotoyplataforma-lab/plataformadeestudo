/**
 * Testes do ModerationService (Administration — curadoria de questões).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockList = vi.fn();
const mockFindById = vi.fn();
const mockSetStatus = vi.fn();
vi.mock("../../repositories/moderation.repository", () => ({
  ModerationRepository: {
    listQuestions: (...args: unknown[]) => mockList(...args),
    findById: (...args: unknown[]) => mockFindById(...args),
    setQuestionStatus: (...args: unknown[]) => mockSetStatus(...args),
  },
}));

const mockRequireAdmin = vi.fn();
vi.mock("../admin-guard.service", () => ({
  AdminGuardService: {
    requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  },
}));

const mockAudit = vi.fn();
vi.mock("../audit.service", () => ({
  AuditService: { record: (...args: unknown[]) => mockAudit(...args) },
}));

import { ModerationService, ModerationError } from "../moderation.service";

const ADMIN = { userId: "a1", email: "admin@x.com" };
const QUESTION = {
  id: "q1",
  knowledgeSubjectId: "00000000-0000-0000-0000-00000000000a",
  status: "rascunho",
  nivel: "medio",
  enunciado: "Pergunta?",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe("ModerationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(undefined);
    mockFindById.mockResolvedValue(QUESTION);
  });

  it("listQuestions requer admin e retorna a lista", async () => {
    mockList.mockResolvedValue({ data: [], total: 0 });
    await ModerationService.listQuestions(ADMIN, { status: "rascunho" });
    expect(mockRequireAdmin).toHaveBeenCalledWith(ADMIN);
    expect(mockList).toHaveBeenCalledWith({ status: "rascunho" });
  });

  it("setStatus publica a questão e audita", async () => {
    mockSetStatus.mockResolvedValue({ id: "q1", status: "publicada" });
    const row = await ModerationService.setStatus(ADMIN, "q1", "publicada");
    expect(row.status).toBe("publicada");
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "a1",
        action: "question.publicada",
        entityType: "question",
        entityId: "q1",
      })
    );
  });

  it("setStatus lança QUESTION_NOT_FOUND quando a questão não existe", async () => {
    mockFindById.mockResolvedValue(null);
    await expect(
      ModerationService.setStatus(ADMIN, "q-x", "publicada")
    ).rejects.toBeInstanceOf(ModerationError);
    expect(mockSetStatus).not.toHaveBeenCalled();
  });

  it("setStatus bloqueia questão e audita", async () => {
    mockSetStatus.mockResolvedValue({ id: "q1", status: "bloqueada" });
    await ModerationService.setStatus(ADMIN, "q1", "bloqueada");
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "question.bloqueada" })
    );
  });

  it("não executa ação quando não é admin", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(
      ModerationService.setStatus(ADMIN, "q1", "publicada")
    ).rejects.toThrow("FORBIDDEN");
    expect(mockSetStatus).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
