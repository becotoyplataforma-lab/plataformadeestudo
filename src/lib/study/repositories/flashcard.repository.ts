/**
 * ConcursoAI — FlashcardRepository
 *
 * Camada de persistência do aggregate Flashcard (inclui ReviewSchedule 1:1).
 */
import { eq, and, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { flashcards, reviewSchedules, studySubjects } from "@/db/schema";

export const FlashcardRepository = {
  /** Buscar flashcard por ID (valida ownership). */
  async findById(id: string, userId: string) {
    const [row] = await db
      .select()
      .from(flashcards)
      .where(
        and(
          eq(flashcards.id, id),
          eq(flashcards.userId, userId),
          isNull(flashcards.deletedAt)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /** Listar flashcards do usuário (com schedule e subject). */
  async listByUser(
    userId: string,
    opts: { studySubjectId?: string; onlyDue?: boolean; limit?: number } = {}
  ) {
    const conditions = [
      eq(flashcards.userId, userId),
      isNull(flashcards.deletedAt),
    ];
    if (opts.studySubjectId) {
      conditions.push(eq(flashcards.studySubjectId, opts.studySubjectId));
    }

    const query = db
      .select({
        id: flashcards.id,
        userId: flashcards.userId,
        studySubjectId: flashcards.studySubjectId,
        subjectName: studySubjects.name,
        subjectColor: studySubjects.color,
        front: flashcards.front,
        back: flashcards.back,
        tags: flashcards.tags,
        createdAt: flashcards.createdAt,
        updatedAt: flashcards.updatedAt,
        scheduleId: reviewSchedules.id,
        intervalDays: reviewSchedules.intervalDays,
        easeFactor: reviewSchedules.easeFactor,
        repetitions: reviewSchedules.repetitions,
        dueDate: reviewSchedules.dueDate,
        lastReviewedAt: reviewSchedules.lastReviewedAt,
      })
      .from(flashcards)
      .leftJoin(
        studySubjects,
        eq(flashcards.studySubjectId, studySubjects.id)
      )
      .leftJoin(
        reviewSchedules,
        eq(flashcards.id, reviewSchedules.flashcardId)
      )
      .where(and(...conditions))
      .orderBy(flashcards.createdAt);

    const rows = await query.limit(opts.limit ?? 200);

    if (opts.onlyDue) {
      const now = new Date();
      return rows.filter(
        (r) => !r.dueDate || r.dueDate.getTime() <= now.getTime()
      );
    }
    return rows;
  },

  /** Listar flashcards vencidos (para revisão). */
  async listDue(userId: string, limit = 50) {
    const now = new Date();
    return db
      .select({
        id: flashcards.id,
        userId: flashcards.userId,
        studySubjectId: flashcards.studySubjectId,
        front: flashcards.front,
        back: flashcards.back,
        tags: flashcards.tags,
        createdAt: flashcards.createdAt,
      })
      .from(flashcards)
      .leftJoin(
        reviewSchedules,
        eq(flashcards.id, reviewSchedules.flashcardId)
      )
      .where(
        and(
          eq(flashcards.userId, userId),
          isNull(flashcards.deletedAt),
          lte(reviewSchedules.dueDate, now)
        )
      )
      .orderBy(reviewSchedules.dueDate)
      .limit(limit);
  },

  /** Criar flashcard. */
  async create(input: typeof flashcards.$inferInsert) {
    const [row] = await db.insert(flashcards).values(input).returning();
    return row;
  },

  /** Atualizar flashcard. */
  async update(
    id: string,
    userId: string,
    patch: Partial<typeof flashcards.$inferInsert>
  ) {
    const [row] = await db
      .update(flashcards)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(flashcards.id, id),
          eq(flashcards.userId, userId),
          isNull(flashcards.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  },

  /** Soft delete. */
  async softDelete(id: string, userId: string) {
    const [row] = await db
      .update(flashcards)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(flashcards.id, id),
          eq(flashcards.userId, userId),
          isNull(flashcards.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  },

  /** Contar flashcards do usuário (coluna com tipo correto). */
  async countByUser(userId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(flashcards)
      .where(
        and(
          eq(flashcards.userId, userId),
          isNull(flashcards.deletedAt)
        )
      );
    return row?.count ?? 0;
  },
};
