/**
 * Testes do AuditService (Administration).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockListRecent = vi.fn();
const mockListByEntity = vi.fn();
const mockListByAdmin = vi.fn();
vi.mock("../../repositories/admin-action-log.repository", () => ({
  AdminActionLogRepository: {
    create: (...args: unknown[]) => mockCreate(...args),
    listRecent: (...args: unknown[]) => mockListRecent(...args),
    listByEntity: (...args: unknown[]) => mockListByEntity(...args),
    listByAdmin: (...args: unknown[]) => mockListByAdmin(...args),
  },
}));

const mockRequireAdmin = vi.fn();
vi.mock("../admin-guard.service", () => ({
  AdminGuardService: {
    requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  },
}));

import { AuditService } from "../audit.service";

const ADMIN = { userId: "a1", email: "admin@x.com" };

describe("AuditService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(undefined);
  });

  it("record persiste uma ação com campos completos", async () => {
    mockCreate.mockResolvedValue({ id: "log1" });
    await AuditService.record({
      adminId: "a1",
      action: "user.ban",
      entityType: "user",
      entityId: "u1",
      details: { motivo: "spam" },
      ip: "10.0.0.1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "a1",
        action: "user.ban",
        entityType: "user",
        entityId: "u1",
        ip: "10.0.0.1",
      })
    );
  });

  it("record sem adminId/ip persiste null", async () => {
    mockCreate.mockResolvedValue({ id: "log1" });
    await AuditService.record({
      adminId: null,
      action: "system.task",
      entityType: "system",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: null, entityId: null, ip: null })
    );
  });

  it("list requer admin e retorna recentes", async () => {
    mockListRecent.mockResolvedValue([{ id: "log1" }]);
    await AuditService.list(ADMIN);
    expect(mockRequireAdmin).toHaveBeenCalledWith(ADMIN);
    expect(mockListRecent).toHaveBeenCalledWith(50);
  });

  it("list com entity_type filtra por entidade", async () => {
    mockListByEntity.mockResolvedValue([{ id: "log1" }]);
    await AuditService.list(ADMIN, { entityType: "question", limit: 10 });
    expect(mockListByEntity).toHaveBeenCalledWith("question", 10);
  });
});
