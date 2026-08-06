/**
 * FASE 18 — Integração real: Administration (SystemSettingRepository,
 * AdminActionLogRepository, AdminGuardService via system_settings).
 */
import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { SystemSettingRepository } from "@/lib/administration/repositories/system-setting.repository";
import { AdminActionLogRepository } from "@/lib/administration/repositories/admin-action-log.repository";
import { AdminGuardService } from "@/lib/administration/services/admin-guard.service";
import { hasDb, createTestUser, deleteTestUser } from "./helpers";

describe.skipIf(!hasDb)("Administration — integração real", () => {
  const users: string[] = [];

  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  afterAll(async () => {
    await SystemSettingRepository.deleteByKey("admin.emails");
    await SystemSettingRepository.deleteByKey("test.key");
    await Promise.all(users.map((id) => deleteTestUser(id)));
  });

  it("upsert e leitura de configuração (chave única)", async () => {
    const row = await SystemSettingRepository.upsert("test.key", { flag: true }, "teste");
    expect(row.key).toBe("test.key");

    const found = await SystemSettingRepository.findByKey("test.key");
    expect(found?.value).toEqual({ flag: true });
  });

  it("admin action log é registrado e listado (imutável)", async () => {
    const adminId = await createTestUser();
    users.push(adminId);

    const log = await AdminActionLogRepository.create({
      adminId,
      action: "test.action",
      entityType: "test",
      details: { a: 1 },
      ip: "127.0.0.1",
    });

    const recent = await AdminActionLogRepository.listRecent(10);
    expect(recent.some((r) => r.id === log.id)).toBe(true);
    expect(recent[0].createdAt).toBeTruthy();
  });

  it("AdminGuardService aceita e-mail da allowlist em system_settings", async () => {
    await SystemSettingRepository.upsert("admin.emails", ["admin@x.com"]);
    await expect(AdminGuardService.isAdminEmail("ADMIN@x.com")).resolves.toBe(true);
    await expect(AdminGuardService.isAdminEmail("outro@x.com")).resolves.toBe(false);
  });
});
