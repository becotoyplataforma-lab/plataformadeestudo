/**
 * Testes do PositionService (Administration).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListByContest = vi.fn();
const mockFindById = vi.fn();
const mockFindBySlug = vi.fn();
const mockFindBySlugExcluding = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockSoftDelete = vi.fn();
vi.mock("../../repositories/position.repository", () => ({
  PositionRepository: {
    listByContest: (...args: unknown[]) => mockListByContest(...args),
    findById: (...args: unknown[]) => mockFindById(...args),
    findBySlug: (...args: unknown[]) => mockFindBySlug(...args),
    findBySlugExcluding: (...args: unknown[]) => mockFindBySlugExcluding(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    softDelete: (...args: unknown[]) => mockSoftDelete(...args),
  },
}));

const mockFindByIdContest = vi.fn();
vi.mock("../../repositories/contest.repository", () => ({
  ContestRepository: {
    findById: (...args: unknown[]) => mockFindByIdContest(...args),
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

import { PositionService, PositionError } from "../position.service";

const ADMIN = { userId: "a1", email: "admin@x.com" };
const CONTEST = { id: "c1", title: "Concurso PMERJ" };
const ROW = {
  id: "p1",
  contestId: "c1",
  editalId: null,
  name: "Soldado PM",
  slug: "soldado-pm",
  description: null,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const BASE = { contestId: "c1", name: "Soldado PM" };

describe("PositionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(undefined);
    mockFindByIdContest.mockResolvedValue(CONTEST);
    mockFindBySlug.mockResolvedValue(null);
    mockCreate.mockResolvedValue(ROW);
    mockUpdate.mockResolvedValue(ROW);
    mockSoftDelete.mockResolvedValue(ROW);
  });

  it("create requer admin, valida concurso, persiste e audita", async () => {
    const row = await PositionService.create(ADMIN, BASE);
    expect(mockRequireAdmin).toHaveBeenCalledWith(ADMIN);
    expect(mockFindByIdContest).toHaveBeenCalledWith("c1");
    expect(mockFindBySlug).toHaveBeenCalledWith("c1", "soldado-pm");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        contestId: "c1",
        name: "Soldado PM",
        slug: "soldado-pm",
        status: "active",
      })
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "a1", action: "position.create", entityType: "position" })
    );
    expect(row).toEqual(ROW);
  });

  it("create usa slug gerado a partir do nome", async () => {
    await PositionService.create(ADMIN, { contestId: "c1", name: "Oficial de Justiça" });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "oficial-de-justica" })
    );
  });

  it("create lança DUPLICATE_SLUG quando já existe no concurso", async () => {
    mockFindBySlug.mockResolvedValue(ROW);
    await expect(PositionService.create(ADMIN, BASE)).rejects.toBeInstanceOf(PositionError);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("create lança CONTEST_NOT_FOUND quando concurso não existe", async () => {
    mockFindByIdContest.mockResolvedValue(null);
    await expect(PositionService.create(ADMIN, BASE)).rejects.toThrow("Concurso não encontrado");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("create lança INVALID_NAME para nome curto", async () => {
    await expect(PositionService.create(ADMIN, { contestId: "c1", name: "A" })).rejects.toThrow(
      "pelo menos 2 caracteres"
    );
  });

  it("create não persiste quando não é admin", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(PositionService.create(ADMIN, BASE)).rejects.toThrow("FORBIDDEN");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("update requer admin, checa slug duplicado e audita", async () => {
    mockFindById.mockResolvedValue(ROW);
    mockFindBySlugExcluding.mockResolvedValue(null);
    await PositionService.update(ADMIN, "p1", { name: "Soldado PM 2026" });
    expect(mockRequireAdmin).toHaveBeenCalledWith(ADMIN);
    expect(mockFindById).toHaveBeenCalledWith("p1");
    expect(mockUpdate).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ name: "Soldado PM 2026" })
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "position.update", entityId: "p1" })
    );
  });

  it("update lança NOT_FOUND quando não existe", async () => {
    mockFindById.mockResolvedValue(null);
    await expect(PositionService.update(ADMIN, "x", { name: "Novo" })).rejects.toThrow(
      "não encontrado"
    );
  });

  it("update lança DUPLICATE_SLUG quando outro cargo usa o slug no mesmo concurso", async () => {
    mockFindById.mockResolvedValue(ROW);
    mockFindBySlugExcluding.mockResolvedValue({ ...ROW, id: "p2" });
    const error = await PositionService.update(ADMIN, "p1", { slug: "usado" }).catch(
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(PositionError);
    expect((error as PositionError).code).toBe("DUPLICATE_SLUG");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("softDelete requer admin, persiste e audita", async () => {
    await PositionService.softDelete(ADMIN, "p1");
    expect(mockRequireAdmin).toHaveBeenCalledWith(ADMIN);
    expect(mockSoftDelete).toHaveBeenCalledWith("p1");
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "position.delete", entityId: "p1" })
    );
  });

  it("softDelete lança NOT_FOUND quando não existe", async () => {
    mockSoftDelete.mockResolvedValue(null);
    await expect(PositionService.softDelete(ADMIN, "x")).rejects.toThrow("não encontrado");
  });
});
