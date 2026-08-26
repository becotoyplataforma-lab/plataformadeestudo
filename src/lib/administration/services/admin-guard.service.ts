/**
 * ConcursoAI — AdminGuardService (Administration)
 *
 * Autorização de administrador no MVP via ALLOWLIST de e-mails (docs/15 §2):
 * - Variável de ambiente ADMIN_EMAILS (lista separada por vírgula).
 * - Configuração `system_settings['admin.emails']` (gerenciável por admin).
 *
 * NÍVEL SUPERADMIN (docs/15 §2, extensão):
 * - Variável de ambiente SUPERADMIN_EMAILS (lista separada por vírgula).
 * - Configuração `system_settings['superadmin.emails']` (gerenciável por superadmin).
 * - Superadmin herda todas as permissões de admin + gestão da allowlist de admins.
 *
 * docs/15 (V1.1) prevê `profiles.is_admin`; como o PROFILE físico (docs/08)
 * não possui esse campo, o MVP usa a allowlist (camada extra prevista no docs/15).
 */
import "server-only";
import { SystemSettingRepository } from "../repositories/system-setting.repository";

export class AdminError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AdminError";
    this.code = code;
  }
}

export interface AdminSession {
  userId: string;
  email: string;
  ip?: string | null;
}

function envAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function envSuperadminEmails(): string[] {
  const raw = process.env.SUPERADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Lê a lista de e-mails de uma chave de system_settings (array de strings). */
async function settingEmailList(key: string): Promise<string[]> {
  const setting = await SystemSettingRepository.findByKey(key);
  const list = Array.isArray(setting?.value)
    ? (setting.value as unknown[])
    : [];
  return list.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
}

export const AdminGuardService = {
  /** true se o e-mail estiver na allowlist de superadmin (env + system_settings). */
  async isSuperadminEmail(email: string | null | undefined): Promise<boolean> {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    if (envSuperadminEmails().includes(normalized)) return true;
    const list = await settingEmailList("superadmin.emails");
    return list.includes(normalized);
  },

  /** true se o e-mail estiver na allowlist (env + system_settings). */
  async isAdminEmail(email: string | null | undefined): Promise<boolean> {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    if (envAdminEmails().includes(normalized)) return true;
    const list = await settingEmailList("admin.emails");
    return list.includes(normalized);
  },

  /** true se o e-mail for admin OU superadmin (superadmin herda admin). */
  async isAdminOrSuperadmin(email: string | null | undefined): Promise<boolean> {
    if (await this.isSuperadminEmail(email)) return true;
    return this.isAdminEmail(email);
  },

  /** Lança AdminError FORBIDDEN se a sessão não for de administrador. */
  async requireAdmin(session: AdminSession): Promise<void> {
    if (!(await this.isAdminOrSuperadmin(session.email))) {
      throw new AdminError("FORBIDDEN", "Acesso restrito a administradores.");
    }
  },

  /** Lança AdminError FORBIDDEN se a sessão não for de superadmin. */
  async requireSuperadmin(session: AdminSession): Promise<void> {
    if (!(await this.isSuperadminEmail(session.email))) {
      throw new AdminError(
        "FORBIDDEN",
        "Acesso restrito a superadministradores."
      );
    }
  },
};
