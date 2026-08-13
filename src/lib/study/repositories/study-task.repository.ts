/**
 * ConcursoAI — StudyTaskRepository
 *
 * Camada de persistência do aggregate StudyTask (tarefa de estudo).
 */
import { eq, and, isNull, gte, lte, inArray, like } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { studyTasks, studySubjects, type taskStatus } from "@/db/schema/study";

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

  /**
   * Listar tarefas do usuário com a disciplina (study_subjects) vinculada.
   * Usado pelo cronograma para exibir a matéria das tarefas geradas pelo
   * planejador adaptativo (mesmo layer do planner — zero migration).
   */
  async listByUserWithSubject(
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
      .select({
        id: studyTasks.id,
        userId: studyTasks.userId,
        studySubjectId: studyTasks.studySubjectId,
        title: studyTasks.title,
        description: studyTasks.description,
        scheduledDate: studyTasks.scheduledDate,
        durationMin: studyTasks.durationMin,
        status: studyTasks.status,
        completedAt: studyTasks.completedAt,
        createdAt: studyTasks.createdAt,
        updatedAt: studyTasks.updatedAt,
        subject: {
          id: studySubjects.id,
          name: studySubjects.name,
          color: studySubjects.color,
          priority: studySubjects.priority,
          carga_horaria_total: studySubjects.cargaHorariaTotal,
          created_at: studySubjects.createdAt,
        },
      })
      .from(studyTasks)
      .leftJoin(studySubjects, eq(studyTasks.studySubjectId, studySubjects.id))
      .where(and(...conditions))
      .orderBy(studyTasks.scheduledDate)
      .limit(opts.limit ?? 200);
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

  /**
   * Substitui o plano atual de tarefas auto-geradas do usuário em uma ÚNICA
   * transação (atômica):
   *  - remove as tarefas PENDENTES do plano atual (assinatura do planner:
   *    `title = "Estudar <matéria>"`), preservando tarefas CONCLUÍDAS;
   *  - NÃO mexe em tarefas de outros usuários;
   *  - insere as novas tarefas calculadas.
   * Se a inserção falhar, a transação é revertida e o cronograma antigo
   * permanece intacto (nunca fica vazio).
   */
  async replacePendingPlan(
    userId: string,
    inputs: (typeof studyTasks.$inferInsert)[]
  ) {
    return db.transaction(async (tx) => {
      await tx
        .delete(studyTasks)
        .where(
          and(
            eq(studyTasks.userId, userId),
            eq(studyTasks.status, "pendente"),
            like(studyTasks.title, "Estudar %"),
            isNull(studyTasks.deletedAt)
          )
        );

      if (inputs.length === 0) return [];
      return tx.insert(studyTasks).values(inputs).returning();
    });
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
