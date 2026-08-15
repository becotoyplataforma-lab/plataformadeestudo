/**
 * ConcursoAI — AvatarRepository
 *
 * Catálogo de avatares (professor virtual — personagens ORIGINAIS).
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { avatars } from "@/db/schema/ai";

export const AvatarRepository = {
  async listActive() {
    return db
      .select()
      .from(avatars)
      .where(and(eq(avatars.ativo, true), isNull(avatars.deletedAt)))
      .orderBy(avatars.nome);
  },

  async listAll() {
    return db
      .select()
      .from(avatars)
      .where(isNull(avatars.deletedAt))
      .orderBy(avatars.nome);
  },

  async findById(id: string) {
    const [row] = await db
      .select()
      .from(avatars)
      .where(and(eq(avatars.id, id), isNull(avatars.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  async create(input: typeof avatars.$inferInsert) {
    const [row] = await db.insert(avatars).values(input).returning();
    return row;
  },
};
