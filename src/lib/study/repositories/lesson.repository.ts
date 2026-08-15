/**
 * ConcursoAI — LessonRepository
 *
 * Persistência de aulas (lessons) e progresso do aluno (lesson_progress).
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { lessons, lessonProgress } from "@/db/schema/study";

export const LessonRepository = {
  async create(input: typeof lessons.$inferInsert) {
    const [row] = await db.insert(lessons).values(input).returning();
    return row;
  },

  async findById(id: string) {
    const [row] = await db
      .select()
      .from(lessons)
      .where(and(eq(lessons.id, id), isNull(lessons.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Aulas visíveis ao aluno (globais ou dele). */
  async listForStudent(userId: string, limit = 100) {
    return db
      .select()
      .from(lessons)
      .where(
        and(
          isNull(lessons.deletedAt),
          sql`(${lessons.userId} is null or ${lessons.userId} = ${userId})`
        )
      )
      .orderBy(sql`${lessons.createdAt} DESC`)
      .limit(limit);
  },

  async listAll(limit = 100) {
    return db
      .select()
      .from(lessons)
      .where(isNull(lessons.deletedAt))
      .orderBy(sql`${lessons.createdAt} DESC`)
      .limit(limit);
  },

  async getProgress(userId: string, lessonId: string) {
    const [row] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.lessonId, lessonId)
        )
      )
      .limit(1);
    return row ?? null;
  },

  async upsertProgress(input: {
    userId: string;
    lessonId: string;
    progress: number;
    currentSection?: string | null;
    completed?: boolean;
  }) {
    const [row] = await db
      .insert(lessonProgress)
      .values({
        userId: input.userId,
        lessonId: input.lessonId,
        progress: String(input.progress),
        currentSection: input.currentSection ?? null,
        completedAt: input.completed ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [lessonProgress.userId, lessonProgress.lessonId],
        set: {
          progress: String(input.progress),
          currentSection: input.currentSection ?? null,
          completedAt: input.completed ? new Date() : sql`${lessonProgress.completedAt}`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  },
};
