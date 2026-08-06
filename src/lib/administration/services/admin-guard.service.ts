/**
 * ConcursoAI — AdminGuardService (Administration)
 *
 * Autorização de administrador no MVP via ALLOWLIST de e-mails (docs/15 §2):
 * - Variável de ambiente ADMIN_EMAILS (lista separada por vírgula).
 * - Configuração `system_settings['admin.emails']` (gerenciável por admin).
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

export const AdminGuardService = {
  /** true se o e-mail estiver na allowlist (env + system_settings). */
  async isAdminEmail(email: string | null | undefined): Promise<boolean> {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    if (envAdminEmails().includes(normalized)) return true;

    const setting = await SystemSettingRepository.findByKey("admin.emails");
    const list = Array.isArray(setting?.value)
      ? (setting.value as unknown[])
      : [];
    return list.some(
      (e) => String(e).trim().toLowerCase() === normalized
    );
  },

  /** Lança AdminError FORBIDDEN se a sessão não for de administrador. */
  async requireAdmin(session: AdminSession): Promise<void> {
    if (!(await this.isAdminEmail(session.email))) {
      throw new AdminError("FORBIDDEN", "Acesso restrito a administradores.");
    }
  },
};
