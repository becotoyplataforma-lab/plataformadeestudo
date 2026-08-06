/**
 * ConcursoAI — ReviewScheduleRepository
 *
 * Camada de persistência do agendamento SRS (ReviewSchedule) — 1:1 com Flashcard.
 */
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { reviewSchedules } from "@/db/schema/study";

export const ReviewScheduleRepository = {
  /** Buscar schedule por flashcard (valida ownership). */
  async findByFlashcard(flashcardId: string, userId: string) {
    const [row] = await db
      .select()
      .from(reviewSchedules)
      .where(
        and(
          eq(reviewSchedules.flashcardId, flashcardId),
          eq(reviewSchedules.userId, userId),
          isNull(reviewSchedules.deletedAt)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /** Buscar schedule por ID (valida ownership). */
  async findById(id: string, userId: string) {
    const [row] = await db
      .select()
      .from(reviewSchedules)
      .where(
        and(
          eq(reviewSchedules.id, id),
          eq(reviewSchedules.userId, userId),
          isNull(reviewSchedules.deletedAt)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /** Criar schedule inicial (novo flashcard). */
  async create(input: typeof reviewSchedules.$inferInsert) {
    const [row] = await db.insert(reviewSchedules).values(input).returning();
    return row;
  },

  /** Atualizar schedule (após revisão SRS). */
  async update(
    id: string,
    userId: string,
    patch: Partial<typeof reviewSchedules.$inferInsert>
  ) {
    const [row] = await db
      .update(reviewSchedules)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(reviewSchedules.id, id),
          eq(reviewSchedules.userId, userId),
          isNull(reviewSchedules.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  },
};
