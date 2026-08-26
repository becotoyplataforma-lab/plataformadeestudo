/**
 * ConcursoAI — AdminManagementService (Administration)
 *
 * Gestão da allowlist de administradores e superadministradores.
 * Acesso EXCLUSIVO de superadmin (docs/15 §2, extensão).
 *
 * Persistência em system_settings:
 * - 'admin.emails'        → lista de e-mails admin (gerenciável por superadmin)
 * - 'superadmin.emails'   → lista de e-mails superadmin (gerenciável por superadmin)
 *
 * Toda mutação é auditada (AdminActionLog).
 */
import "server-only";
import { SystemSettingRepository } from "../repositories/system-setting.repository";
import {
  AdminGuardService,
  AdminError,
  type AdminSession,
} from "./admin-guard.service";
import { AuditService } from "./audit.service";

export class AdminManagementError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AdminManagementError";
    this.code = code;
  }
}

const ADMIN_KEY = "admin.emails";
const SUPERADMIN_KEY = "superadmin.emails";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readList(key: string): Promise<string[]> {
  const setting = await SystemSettingRepository.findByKey(key);
  const list = Array.isArray(setting?.value)
    ? (setting.value as unknown[])
    : [];
  return list.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
}

async function writeList(
  admin: AdminSession,
  key: string,
  emails: string[],
  action: string
): Promise<string[]> {
  const unique = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  const row = await SystemSettingRepository.upsert(key, unique);
  await AuditService.record({
    adminId: admin.userId,
    action,
    entityType: "system_setting",
    entityId: row.id,
    details: { key, emails: unique },
    ip: admin.ip,
  });
  return unique;
}

export const AdminManagementService = {
  /** Lista admins e superadmins (somente superadmin). */
  async list(admin: AdminSession) {
    await AdminGuardService.requireSuperadmin(admin);
    const [admins, superadmins] = await Promise.all([
      readList(ADMIN_KEY),
      readList(SUPERADMIN_KEY),
    ]);
    return { admins, superadmins };
  },

  /** Adiciona um e-mail à allowlist de admins (somente superadmin). */
  async addAdmin(admin: AdminSession, email: string) {
    await AdminGuardService.requireSuperadmin(admin);
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      throw new AdminManagementError(
        "INVALID_EMAIL",
        "E-mail inválido."
      );
    }
    const current = await readList(ADMIN_KEY);
    if (current.includes(normalized)) {
      throw new AdminManagementError(
        "ALREADY_ADMIN",
        "Este e-mail já é administrador."
      );
    }
    return writeList(admin, ADMIN_KEY, [...current, normalized], "admin.add");
  },

  /** Remove um e-mail da allowlist de admins (somente superadmin). */
  async removeAdmin(admin: AdminSession, email: string) {
    await AdminGuardService.requireSuperadmin(admin);
    const normalized = normalizeEmail(email);
    const current = await readList(ADMIN_KEY);
    const next = current.filter((e) => e !== normalized);
    if (next.length === current.length) {
      throw new AdminManagementError(
        "NOT_ADMIN",
        "Este e-mail não está na lista de administradores."
      );
    }
    return writeList(admin, ADMIN_KEY, next, "admin.remove");
  },

  /** Adiciona um e-mail à allowlist de superadmins (somente superadmin). */
  async addSuperadmin(admin: AdminSession, email: string) {
    await AdminGuardService.requireSuperadmin(admin);
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      throw new AdminManagementError(
        "INVALID_EMAIL",
        "E-mail inválido."
      );
    }
    const current = await readList(SUPERADMIN_KEY);
    if (current.includes(normalized)) {
      throw new AdminManagementError(
        "ALREADY_SUPERADMIN",
        "Este e-mail já é superadministrador."
      );
    }
    return writeList(
      admin,
      SUPERADMIN_KEY,
      [...current, normalized],
      "superadmin.add"
    );
  },

  /** Remove um e-mail da allowlist de superadmins (somente superadmin). */
  async removeSuperadmin(admin: AdminSession, email: string) {
    await AdminGuardService.requireSuperadmin(admin);
    const normalized = normalizeEmail(email);
    const current = await readList(SUPERADMIN_KEY);
    const next = current.filter((e) => e !== normalized);
    if (next.length === current.length) {
      throw new AdminManagementError(
        "NOT_SUPERADMIN",
        "Este e-mail não está na lista de superadministradores."
      );
    }
    return writeList(admin, SUPERADMIN_KEY, next, "superadmin.remove");
  },

  /** Impede que um superadmin remova a si mesmo (proteção contra lockout). */
  async assertNotSelf(admin: AdminSession, email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    if (normalized === normalizeEmail(admin.email)) {
      throw new AdminError(
        "SELF_REMOVAL",
        "Você não pode remover a si mesmo da lista de superadministradores."
      );
    }
  },
};
