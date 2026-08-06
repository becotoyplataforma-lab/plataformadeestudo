/**
 * Testes do SystemSettingService (Administration).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindByKey = vi.fn();
const mockList = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();
vi.mock("../../repositories/system-setting.repository", () => ({
  SystemSettingRepository: {
    findByKey: (...args: unknown[]) => mockFindByKey(...args),
    list: (...args: unknown[]) => mockList(...args),
    upsert: (...args: unknown[]) => mockUpsert(...args),
    deleteByKey: (...args: unknown[]) => mockDelete(...args),
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

import { SystemSettingService, SettingError } from "../system-setting.service";

const ADMIN = { userId: "a1", email: "admin@x.com" };
const ROW = {
  id: "s1",
  key: "platform.maintenance_mode",
  value: false,
  description: "Modo manutenção",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("SystemSettingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(undefined);
    mockUpsert.mockResolvedValue(ROW);
    mockDelete.mockResolvedValue(ROW);
  });

  it("set requer admin, persiste e audita", async () => {
    await SystemSettingService.set(ADMIN, "platform.maintenance_mode", false, "Modo manutenção");
    expect(mockRequireAdmin).toHaveBeenCalledWith(ADMIN);
    expect(mockUpsert).toHaveBeenCalledWith(
      "platform.maintenance_mode",
      false,
      "Modo manutenção"
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "a1", action: "setting.update", entityType: "system_setting" })
    );
  });

  it("set lança INVALID_KEY para chave vazia", async () => {
    await expect(
      SystemSettingService.set(ADMIN, "   ", true)
    ).rejects.toBeInstanceOf(SettingError);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("set não persiste quando não é admin", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(
      SystemSettingService.set(ADMIN, "k", true)
    ).rejects.toThrow("FORBIDDEN");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("list requer admin", async () => {
    mockList.mockResolvedValue([ROW]);
    await SystemSettingService.list(ADMIN);
    expect(mockRequireAdmin).toHaveBeenCalledWith(ADMIN);
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it("remove configuração e audita quando encontrada", async () => {
    await SystemSettingService.remove(ADMIN, "platform.maintenance_mode");
    expect(mockDelete).toHaveBeenCalledWith("platform.maintenance_mode");
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "setting.delete" })
    );
  });

  it("remove retorna null sem auditar quando ausente", async () => {
    mockDelete.mockResolvedValue(null);
    await expect(SystemSettingService.remove(ADMIN, "x")).resolves.toBeNull();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("get retorna default quando a chave não existe", async () => {
    mockFindByKey.mockResolvedValue(null);
    await expect(
      SystemSettingService.get("platform.maintenance_mode", true)
    ).resolves.toBe(true);
  });

  it("get retorna o valor quando a chave existe", async () => {
    mockFindByKey.mockResolvedValue(ROW);
    await expect(
      SystemSettingService.get("platform.maintenance_mode")
    ).resolves.toBe(false);
  });
});
