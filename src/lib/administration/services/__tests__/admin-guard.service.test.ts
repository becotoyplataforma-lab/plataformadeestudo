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
});
