/**
 * ConcursoAI — StudyPlannerService
 *
 * Gerencia study_subjects (disciplinas do aluno) e study_tasks (cronograma).
 * Todas as regras de negócio vivem aqui (DD-005). Sem SQL.
 */
import { StudySubjectRepository } from "../repositories/study-subject.repository";
import { StudyTaskRepository, type TaskStatus } from "../repositories/study-task.repository";

export class StudyPlannerError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "StudyPlannerError";
    this.code = code;
  }
}

// ============================================================
// StudySubject
// ============================================================

export const StudyPlannerService = {
  async listSubjects(userId: string) {
    return StudySubjectRepository.listByUser(userId);
  },

  async createSubject(
    userId: string,
    input: { name: string; color?: string; priority?: number; carga_horaria_total?: number }
  ) {
    const name = input.name.trim();
    if (!name) throw new StudyPlannerError("INVALID_NAME", "Nome da disciplina é obrigatório.");

    const exists = await StudySubjectRepository.existsByName(userId, name);
    if (exists) {
      throw new StudyPlannerError(
        "DUPLICATE_SUBJECT",
        "Você já possui uma disciplina com este nome."
      );
    }

    return StudySubjectRepository.create({
      userId,
      name,
      color: input.color ?? null,
      priority: input.priority ?? 3,
      cargaHorariaTotal: input.carga_horaria_total ?? 0,
    });
  },

  async updateSubject(
    userId: string,
    id: string,
    patch: { name?: string; color?: string; priority?: number; carga_horaria_total?: number }
  ) {
    const existing = await StudySubjectRepository.findById(id, userId);
    if (!existing) {
      throw new StudyPlannerError("NOT_FOUND", "Disciplina não encontrada.");
    }

    if (patch.name) {
      const name = patch.name.trim();
      if (!name) throw new StudyPlannerError("INVALID_NAME", "Nome da disciplina é obrigatório.");
      if (name !== existing.name) {
        const dup = await StudySubjectRepository.existsByName(userId, name);
        if (dup) {
          throw new StudyPlannerError(
            "DUPLICATE_SUBJECT",
            "Você já possui uma disciplina com este nome."
          );
        }
      }
      patch.name = name;
    }

    return StudySubjectRepository.update(id, userId, {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.color !== undefined && { color: patch.color ?? null }),
      ...(patch.priority !== undefined && { priority: patch.priority }),
      ...(patch.carga_horaria_total !== undefined && {
        cargaHorariaTotal: patch.carga_horaria_total,
      }),
    });
  },

  async deleteSubject(userId: string, id: string) {
    const existing = await StudySubjectRepository.findById(id, userId);
    if (!existing) {
      throw new StudyPlannerError("NOT_FOUND", "Disciplina não encontrada.");
    }
    return StudySubjectRepository.softDelete(id, userId);
  },

  // ============================================================
  // StudyTask
  // ============================================================

  async listTasks(
    userId: string,
    opts: { status?: TaskStatus; from?: string; to?: string } = {}
  ) {
    return StudyTaskRepository.listByUser(userId, {
      status: opts.status,
      from: opts.from ? new Date(opts.from) : undefined,
      to: opts.to ? new Date(opts.to) : undefined,
    });
  },

  async createTask(
    userId: string,
    input: {
      study_subject_id?: string;
      title: string;
      description?: string;
      scheduled_date: string;
      duration_min?: number;
    }
  ) {
    const title = input.title.trim();
    if (!title) throw new StudyPlannerError("INVALID_TITLE", "Título da tarefa é obrigatório.");

    if (input.study_subject_id) {
      const subject = await StudySubjectRepository.findById(input.study_subject_id, userId);
      if (!subject) {
        throw new StudyPlannerError("SUBJECT_NOT_FOUND", "Disciplina informada não encontrada.");
      }
    }

    const scheduledDate = new Date(input.scheduled_date);
    if (Number.isNaN(scheduledDate.getTime())) {
      throw new StudyPlannerError("INVALID_DATE", "Data agendada inválida.");
    }

    return StudyTaskRepository.create({
      userId,
      studySubjectId: input.study_subject_id ?? null,
      title,
      description: input.description ?? null,
      scheduledDate,
      durationMin: input.duration_min ?? 30,
    });
  },

  async updateTask(
    userId: string,
    id: string,
    patch: {
      title?: string;
      description?: string;
      scheduled_date?: string;
      duration_min?: number;
      status?: TaskStatus;
    }
  ) {
    const existing = await StudyTaskRepository.findById(id, userId);
    if (!existing) {
      throw new StudyPlannerError("NOT_FOUND", "Tarefa não encontrada.");
    }

    if (patch.scheduled_date) {
      const d = new Date(patch.scheduled_date);
      if (Number.isNaN(d.getTime())) {
        throw new StudyPlannerError("INVALID_DATE", "Data agendada inválida.");
      }
      patch.scheduled_date = d.toISOString();
    }

    return StudyTaskRepository.update(id, userId, {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.description !== undefined && { description: patch.description ?? null }),
      ...(patch.scheduled_date !== undefined && { scheduledDate: new Date(patch.scheduled_date) }),
      ...(patch.duration_min !== undefined && { durationMin: patch.duration_min }),
      ...(patch.status !== undefined && { status: patch.status }),
    });
  },

  async completeTask(userId: string, id: string) {
    const existing = await StudyTaskRepository.findById(id, userId);
    if (!existing) {
      throw new StudyPlannerError("NOT_FOUND", "Tarefa não encontrada.");
    }
    if (existing.status === "concluida") {
      return existing;
    }
    return StudyTaskRepository.complete(id, userId);
  },

  async deleteTask(userId: string, id: string) {
    const existing = await StudyTaskRepository.findById(id, userId);
    if (!existing) {
      throw new StudyPlannerError("NOT_FOUND", "Tarefa não encontrada.");
    }
    return StudyTaskRepository.softDelete(id, userId);
  },
};
