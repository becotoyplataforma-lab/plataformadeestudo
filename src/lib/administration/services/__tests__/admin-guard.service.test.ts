/**
 * Testes do AdminGuardService (Administration) — allowlist de e-mails.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindByKey = vi.fn();
vi.mock("../../repositories/system-setting.repository", () => ({
  SystemSettingRepository: {
    findByKey: (...args: unknown[]) => mockFindByKey(...args),
    list: vi.fn(),
    upsert: vi.fn(),
    deleteByKey: vi.fn(),
  },
}));

import { AdminGuardService } from "../admin-guard.service";

describe("AdminGuardService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_EMAILS;
    delete process.env.SUPERADMIN_EMAILS;
    mockFindByKey.mockResolvedValue(null);
  });

  it("rejeita e-mail ausente", async () => {
    await expect(AdminGuardService.isAdminEmail(null)).resolves.toBe(false);
    await expect(AdminGuardService.isAdminEmail(undefined)).resolves.toBe(false);
  });

  it("aceita e-mail da allowlist de ambiente (case-insensitive)", async () => {
    process.env.ADMIN_EMAILS = "a@x.com, b@x.com";
    await expect(AdminGuardService.isAdminEmail("A@X.com")).resolves.toBe(true);
  });

  it("aceita e-mail da allowlist de system_settings", async () => {
    mockFindByKey.mockResolvedValue({
      id: "1",
      key: "admin.emails",
      value: ["admin@x.com", "ops@x.com"],
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(AdminGuardService.isAdminEmail("ops@x.com")).resolves.toBe(true);
  });

  it("rejeita e-mail fora da allowlist", async () => {
    process.env.ADMIN_EMAILS = "a@x.com";
    await expect(AdminGuardService.isAdminEmail("outro@x.com")).resolves.toBe(false);
  });

  it("requireAdmin lança FORBIDDEN para não-admin", async () => {
    process.env.ADMIN_EMAILS = "a@x.com";
    await expect(
      AdminGuardService.requireAdmin({ userId: "u1", email: "nope@x.com" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requireAdmin passa para admin", async () => {
    process.env.ADMIN_EMAILS = "a@x.com";
    await expect(
      AdminGuardService.requireAdmin({ userId: "u1", email: "a@x.com" })
    ).resolves.toBeUndefined();
  });

  // ===== SUPERADMIN =====

  it("isSuperadminEmail aceita e-mail da allowlist de ambiente", async () => {
    process.env.SUPERADMIN_EMAILS = "root@x.com";
    await expect(
      AdminGuardService.isSuperadminEmail("ROOT@x.com")
    ).resolves.toBe(true);
  });

  it("isSuperadminEmail aceita e-mail de system_settings", async () => {
    mockFindByKey.mockResolvedValue({
      id: "1",
      key: "superadmin.emails",
      value: ["root@x.com"],
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(
      AdminGuardService.isSuperadminEmail("root@x.com")
    ).resolves.toBe(true);
  });

  it("isSuperadminEmail rejeita e-mail fora da allowlist", async () => {
    process.env.SUPERADMIN_EMAILS = "root@x.com";
    await expect(
      AdminGuardService.isSuperadminEmail("outro@x.com")
    ).resolves.toBe(false);
  });

  it("isAdminOrSuperadmin aceita superadmin mesmo sem ser admin", async () => {
    process.env.SUPERADMIN_EMAILS = "root@x.com";
    delete process.env.ADMIN_EMAILS;
    await expect(
      AdminGuardService.isAdminOrSuperadmin("root@x.com")
    ).resolves.toBe(true);
  });

  it("isAdminOrSuperadmin aceita admin comum", async () => {
    process.env.ADMIN_EMAILS = "a@x.com";
    delete process.env.SUPERADMIN_EMAILS;
    await expect(
      AdminGuardService.isAdminOrSuperadmin("a@x.com")
    ).resolves.toBe(true);
  });

  it("requireSuperadmin lança FORBIDDEN para não-superadmin", async () => {
    process.env.ADMIN_EMAILS = "a@x.com";
    delete process.env.SUPERADMIN_EMAILS;
    await expect(
      AdminGuardService.requireSuperadmin({ userId: "u1", email: "a@x.com" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requireSuperadmin passa para superadmin", async () => {
    process.env.SUPERADMIN_EMAILS = "root@x.com";
    await expect(
      AdminGuardService.requireSuperadmin({ userId: "u1", email: "root@x.com" })
    ).resolves.toBeUndefined();
  });
});
