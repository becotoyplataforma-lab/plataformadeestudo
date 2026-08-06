/**
 * ConcursoAI — StudySubjectRepository
 *
 * Camada de persistência do aggregate StudySubject (disciplina do aluno).
 */
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { studySubjects } from "@/db/schema/study";

export const StudySubjectRepository = {
  /** Buscar disciplina por ID (valida ownership). */
  async findById(id: string, userId: string) {
    const [row] = await db
      .select()
      .from(studySubjects)
      .where(
        and(
          eq(studySubjects.id, id),
          eq(studySubjects.userId, userId),
          isNull(studySubjects.deletedAt)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /** Listar disciplinas do usuário. */
  async listByUser(userId: string) {
    return db
      .select()
      .from(studySubjects)
      .where(
        and(
          eq(studySubjects.userId, userId),
          isNull(studySubjects.deletedAt)
        )
      )
      .orderBy(studySubjects.priority, studySubjects.name);
  },

  /** Verificar se nome já existe para o usuário. */
  async existsByName(userId: string, name: string) {
    const [row] = await db
      .select({ id: studySubjects.id })
      .from(studySubjects)
      .where(
        and(
          eq(studySubjects.userId, userId),
          eq(studySubjects.name, name),
          isNull(studySubjects.deletedAt)
        )
      )
      .limit(1);
    return Boolean(row);
  },

  /** Criar disciplina. */
  async create(input: typeof studySubjects.$inferInsert) {
    const [row] = await db.insert(studySubjects).values(input).returning();
    return row;
  },

  /** Atualizar disciplina. */
  async update(
    id: string,
    userId: string,
    patch: Partial<typeof studySubjects.$inferInsert>
  ) {
    const [row] = await db
      .update(studySubjects)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(studySubjects.id, id),
          eq(studySubjects.userId, userId),
          isNull(studySubjects.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  },

  /** Soft delete. */
  async softDelete(id: string, userId: string) {
    const [row] = await db
      .update(studySubjects)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(studySubjects.id, id),
          eq(studySubjects.userId, userId),
          isNull(studySubjects.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  },
};
