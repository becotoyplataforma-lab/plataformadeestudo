/**
 * E2E — Administration.
 *
 * - Usuário comum (E2E_USER_EMAIL) recebe 403 nas rotas admin.
 * - Com E2E_ADMIN_EMAIL na allowlist, admin acessa configurações e auditoria.
 * Requer backend real.
 */
import { test, expect } from "@playwright/test";
import { getAuthContext, hasAuth } from "./support/auth";

test.describe("Administration", () => {
  test.skip(!hasAuth, "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD (backend real)");
  test("usuário não-admin recebe 403 em rota administrativa", async () => {
    const api = await getAuthContext();
    const res = await api.get("/api/admin/settings");
    expect(res.status()).toBe(403);
  });

  test.skip(
    !process.env.E2E_ADMIN_EMAIL,
    "Requer E2E_ADMIN_EMAIL na allowlist de administradores"
  );
  test("admin lista configurações e auditoria", async () => {
    const api = await getAuthContext();

    const settingsRes = await api.get("/api/admin/settings");
    expect(settingsRes.ok()).toBeTruthy();
    const settings = (await settingsRes.json()) as { data: unknown[] };
    expect(Array.isArray(settings.data)).toBe(true);

    const auditRes = await api.get("/api/admin/audit");
    expect(auditRes.ok()).toBeTruthy();
    const audit = (await auditRes.json()) as { data: unknown[] };
    expect(Array.isArray(audit.data)).toBe(true);
  });

  test.skip(
    !process.env.E2E_ADMIN_EMAIL,
    "Requer E2E_ADMIN_EMAIL na allowlist de administradores"
  );
  test("admin atualiza uma configuração e a remove", async () => {
    const api = await getAuthContext();
    const key = `e2e.flag.${Date.now()}`;

    const setRes = await api.post("/api/admin/settings", {
      data: { key, value: { ok: true }, description: "E2E" },
    });
    expect(setRes.ok()).toBeTruthy();

    const delRes = await api.delete(`/api/admin/settings/${key}`);
    expect(delRes.ok()).toBeTruthy();
  });
});
