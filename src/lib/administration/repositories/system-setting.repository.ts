/**
 * ConcursoAI — SystemSettingRepository (Administration)
 *
 * Persistência do aggregate SystemSetting (configuração global, sem ownership).
 * Chave única (docs/08 — system_settings.key).
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { systemSettings } from "@/db/schema/administration";

export const SystemSettingRepository = {
  /** Buscar configuração por chave. */
  async findByKey(key: string) {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);
    return row ?? null;
  },

  /** Listar todas as configurações. */
  async list() {
    return db.select().from(systemSettings).orderBy(systemSettings.key);
  },

  /** Criar ou atualizar configuração por chave. */
  async upsert(key: string, value: unknown, description?: string | null) {
    const [row] = await db
      .insert(systemSettings)
      .values({ key, value: value as never, description: description ?? null })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: value as never,
          ...(description !== undefined ? { description: description ?? null } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  },

  /** Remover configuração por chave. */
  async deleteByKey(key: string) {
    const [row] = await db
      .delete(systemSettings)
      .where(eq(systemSettings.key, key))
      .returning();
    return row ?? null;
  },
};
