/**
 * ConcursoAI — StudyTaskRepository
 *
 * Camada de persistência do aggregate StudyTask (tarefa de estudo).
 */
import { eq, and, isNull, gte, lte, inArray } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { studyTasks, type taskStatus } from "@/db/schema/study";

export type TaskStatus = (typeof taskStatus.enumValues)[number];

export const StudyTaskRepository = {
  /** Buscar tarefa por ID (valida ownership). */
  async findById(id: string, userId: string) {
    const [row] = await db
      .select()
      .from(studyTasks)
      .where(
        and(
          eq(studyTasks.id, id),
          eq(studyTasks.userId, userId),
          isNull(studyTasks.deletedAt)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /** Listar tarefas do usuário (com filtros). */
  async listByUser(
    userId: string,
    opts: { status?: TaskStatus; from?: Date; to?: Date; limit?: number } = {}
  ) {
    const conditions = [
      eq(studyTasks.userId, userId),
      isNull(studyTasks.deletedAt),
    ];
    if (opts.status) conditions.push(eq(studyTasks.status, opts.status));
    if (opts.from) conditions.push(gte(studyTasks.scheduledDate, opts.from));
    if (opts.to) conditions.push(lte(studyTasks.scheduledDate, opts.to));

    return db
      .select()
      .from(studyTasks)
      .where(and(...conditions))
      .orderBy(studyTasks.scheduledDate)
      .limit(opts.limit ?? 100);
  },

  /** Listar tarefas por conjunto de IDs. */
  async findByIds(ids: string[], userId: string) {
    if (ids.length === 0) return [];
    return db
      .select()
      .from(studyTasks)
      .where(
        and(
          inArray(studyTasks.id, ids),
          eq(studyTasks.userId, userId),
          isNull(studyTasks.deletedAt)
        )
      );
  },

  /** Criar tarefa. */
  async create(input: typeof studyTasks.$inferInsert) {
    const [row] = await db.insert(studyTasks).values(input).returning();
    return row;
  },

  /** Criar múltiplas tarefas (planner). */
  async createBatch(inputs: (typeof studyTasks.$inferInsert)[]) {
    if (inputs.length === 0) return [];
    return db.insert(studyTasks).values(inputs).returning();
  },

  /** Atualizar tarefa. */
  async update(
    id: string,
    userId: string,
    patch: Partial<typeof studyTasks.$inferInsert>
  ) {
    const [row] = await db
      .update(studyTasks)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(studyTasks.id, id),
          eq(studyTasks.userId, userId),
          isNull(studyTasks.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  },

  /** Concluir tarefa. */
  async complete(id: string, userId: string) {
    const [row] = await db
      .update(studyTasks)
      .set({
        status: "concluida",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(studyTasks.id, id),
          eq(studyTasks.userId, userId),
          isNull(studyTasks.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  },

  /** Soft delete. */
  async softDelete(id: string, userId: string) {
    const [row] = await db
      .update(studyTasks)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(studyTasks.id, id),
          eq(studyTasks.userId, userId),
          isNull(studyTasks.deletedAt)
        )
      )
      .returning();
    return row ?? null;
  },
};
