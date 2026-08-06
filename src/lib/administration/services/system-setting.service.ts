/**
 * ConcursoAI — SystemSettingService (Administration)
 *
 * Gestão de configurações globais (docs/05 — SystemSetting; docs/08).
 * Chave única; somente administrador altera configurações.
 */
import "server-only";
import { SystemSettingRepository } from "../repositories/system-setting.repository";
import { AdminGuardService, type AdminSession } from "./admin-guard.service";
import { AuditService } from "./audit.service";

export class SettingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SettingError";
    this.code = code;
  }
}

export const SystemSettingService = {
  /** Lê uma configuração (server-side; default quando ausente). */
  async get(key: string, defaultValue: unknown = null) {
    const row = await SystemSettingRepository.findByKey(key);
    return row ? row.value : defaultValue;
  },

  /** Lista configurações (somente admin). */
  async list(admin: AdminSession) {
    await AdminGuardService.requireAdmin(admin);
    return SystemSettingRepository.list();
  },

  /** Cria/atualiza configuração (somente admin) + auditoria. */
  async set(
    admin: AdminSession,
    key: string,
    value: unknown,
    description?: string
  ) {
    await AdminGuardService.requireAdmin(admin);
    if (!key || !key.trim()) {
      throw new SettingError("INVALID_KEY", "Chave de configuração inválida.");
    }
    const row = await SystemSettingRepository.upsert(key, value, description);
    await AuditService.record({
      adminId: admin.userId,
      action: "setting.update",
      entityType: "system_setting",
      entityId: row.id,
      details: { key },
      ip: admin.ip,
    });
    return row;
  },

  /** Remove configuração (somente admin) + auditoria. */
  async remove(admin: AdminSession, key: string) {
    await AdminGuardService.requireAdmin(admin);
    const row = await SystemSettingRepository.deleteByKey(key);
    if (row) {
      await AuditService.record({
        adminId: admin.userId,
        action: "setting.delete",
        entityType: "system_setting",
        entityId: row.id,
        details: { key },
        ip: admin.ip,
      });
    }
    return row;
  },
};
