/**
 * Testes do ContestService (Administration).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListAll = vi.fn();
const mockFindById = vi.fn();
const mockFindBySlug = vi.fn();
const mockFindBySlugExcluding = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockSoftDelete = vi.fn();
vi.mock("../../repositories/contest.repository", () => ({
  ContestRepository: {
    listAll: (...args: unknown[]) => mockListAll(...args),
    findById: (...args: unknown[]) => mockFindById(...args),
    findBySlug: (...args: unknown[]) => mockFindBySlug(...args),
    findBySlugExcluding: (...args: unknown[]) => mockFindBySlugExcluding(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    softDelete: (...args: unknown[]) => mockSoftDelete(...args),
  },
}));

const mockFindOrganById = vi.fn();
const mockFindBoardById = vi.fn();
vi.mock("../../repositories/organ-board.repository", () => ({
  OrganBoardRepository: {
    findOrganById: (...args: unknown[]) => mockFindOrganById(...args),
    findBoardById: (...args: unknown[]) => mockFindBoardById(...args),
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

import { ContestService, ContestError } from "../contest.service";

const ADMIN = { userId: "a1", email: "admin@x.com" };
const ORGAN = { id: "o1", name: "PMERJ", slug: "real-pmerj" };
const BOARD = { id: "b1", name: "CEBRASPE", slug: "cebraspe" };
const ROW = {
  id: "c1",
  organId: "o1",
  boardId: "b1",
  title: "Concurso PMERJ",
  slug: "concurso-pmerj",
  description: null,
  status: "rascunho",
  startDate: null,
  endDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const BASE = { organId: "o1", boardId: "b1", title: "Concurso PMERJ" };

describe("ContestService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(undefined);
    mockFindOrganById.mockResolvedValue(ORGAN);
    mockFindBoardById.mockResolvedValue(BOARD);
    mockFindBySlug.mockResolvedValue(null);
    mockCreate.mockResolvedValue(ROW);
    mockUpdate.mockResolvedValue(ROW);
    mockSoftDelete.mockResolvedValue(ROW);
  });

  it("create requer admin, valida órgão/banca, persiste e audita", async () => {
    const row = await ContestService.create(ADMIN, BASE);
    expect(mockRequireAdmin).toHaveBeenCalledWith(ADMIN);
    expect(mockFindOrganById).toHaveBeenCalledWith("o1");
    expect(mockFindBoardById).toHaveBeenCalledWith("b1");
    expect(mockFindBySlug).toHaveBeenCalledWith("concurso-pmerj");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Concurso PMERJ",
        slug: "concurso-pmerj",
        status: "rascunho",
      })
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "a1", action: "contest.create", entityType: "contest" })
    );
    expect(row).toEqual(ROW);
  });

  it("create usa slug gerado a partir do título", async () => {
    await ContestService.create(ADMIN, { ...BASE, title: "Concurso PMERJ — Soldado" });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "concurso-pmerj-soldado" })
    );
  });

  it("create aceita slug explícito", async () => {
    await ContestService.create(ADMIN, { ...BASE, slug: "meu-slug" });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ slug: "meu-slug" }));
  });

  it("create lança DUPLICATE_SLUG quando já existe", async () => {
    mockFindBySlug.mockResolvedValue(ROW);
    await expect(ContestService.create(ADMIN, BASE)).rejects.toBeInstanceOf(ContestError);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("create lança ORG_NOT_FOUND quando órgão não existe", async () => {
    mockFindOrganById.mockResolvedValue(null);
    await expect(ContestService.create(ADMIN, BASE)).rejects.toThrow("Órgão não encontrado");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("create lança BOARD_NOT_FOUND quando banca não existe", async () => {
    mockFindBoardById.mockResolvedValue(null);
    await expect(ContestService.create(ADMIN, BASE)).rejects.toThrow("Banca não encontrada");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("create lança INVALID_TITLE para título curto", async () => {
    await expect(ContestService.create(ADMIN, { ...BASE, title: "ab" })).rejects.toThrow(
      "pelo menos 3 caracteres"
    );
  });

  it("create lança INVALID_PERIOD quando end < start", async () => {
    await expect(
      ContestService.create(ADMIN, {
        ...BASE,
        startDate: "2026-01-01",
        endDate: "2025-01-01",
      })
    ).rejects.toThrow("data final deve ser maior");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("create não persiste quando não é admin", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(ContestService.create(ADMIN, BASE)).rejects.toThrow("FORBIDDEN");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("update requer admin, checa slug duplicado e audita", async () => {
    mockFindById.mockResolvedValue(ROW);
    mockFindBySlugExcluding.mockResolvedValue(null);
    await ContestService.update(ADMIN, "c1", { title: "Novo título" });
    expect(mockRequireAdmin).toHaveBeenCalledWith(ADMIN);
    expect(mockFindById).toHaveBeenCalledWith("c1");
    expect(mockUpdate).toHaveBeenCalledWith("c1", expect.objectContaining({ title: "Novo título" }));
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "contest.update", entityId: "c1" })
    );
  });

  it("update lança NOT_FOUND quando não existe", async () => {
    mockFindById.mockResolvedValue(null);
    await expect(ContestService.update(ADMIN, "x", { title: "Novo" })).rejects.toThrow(
      "não encontrado"
    );
  });

  it("update lança DUPLICATE_SLUG quando outro concurso usa o slug", async () => {
    mockFindById.mockResolvedValue(ROW);
    mockFindBySlugExcluding.mockResolvedValue({ ...ROW, id: "c2" });
    await expect(ContestService.update(ADMIN, "c1", { slug: "usado" })).rejects.toThrow(
      "slug"
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("softDelete requer admin, persiste e audita", async () => {
    mockSoftDelete.mockResolvedValue(ROW);
    await ContestService.softDelete(ADMIN, "c1");
    expect(mockRequireAdmin).toHaveBeenCalledWith(ADMIN);
    expect(mockSoftDelete).toHaveBeenCalledWith("c1");
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "contest.delete", entityId: "c1" })
    );
  });

  it("softDelete lança NOT_FOUND quando não existe", async () => {
    mockSoftDelete.mockResolvedValue(null);
    await expect(ContestService.softDelete(ADMIN, "x")).rejects.toThrow("não encontrado");
  });
});
