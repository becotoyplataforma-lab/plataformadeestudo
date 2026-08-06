/**
 * FASE 18 — Integração real: Study (StudySubjectRepository, StudyTaskRepository
 * no Postgres real).
 */
import { describe, it, expect, afterAll } from "vitest";
import { StudySubjectRepository } from "@/lib/study/repositories/study-subject.repository";
import { StudyTaskRepository } from "@/lib/study/repositories/study-task.repository";
import { hasDb, createTestUser, deleteTestUser } from "./helpers";

describe.skipIf(!hasDb)("Study — integração real", () => {
  const users: string[] = [];

  afterAll(async () => {
    await Promise.all(users.map((id) => deleteTestUser(id)));
  });

  it("cria disciplina e tarefa e lista por usuário", async () => {
    const userId = await createTestUser();
    users.push(userId);

    const subj = await StudySubjectRepository.create({
      userId,
      name: "Direito Constitucional",
    });
    expect(subj.id).toBeTruthy();

    const task = await StudyTaskRepository.create({
      userId,
      studySubjectId: subj.id,
      title: "Revisar art. 5º",
      scheduledDate: new Date(),
      durationMin: 60,
      status: "pendente",
    });
    expect(task.id).toBeTruthy();

    const list = await StudySubjectRepository.listByUser(userId);
    expect(list.some((s) => s.id === subj.id)).toBe(true);

    const tasks = await StudyTaskRepository.listByUser(userId);
    expect(tasks.some((t) => t.id === task.id)).toBe(true);
  });

  it("impede disciplina duplicada para o mesmo usuário (índice parcial)", async () => {
    const userId = await createTestUser();
    users.push(userId);

    await StudySubjectRepository.create({ userId, name: "Matemática" });
    await expect(
      StudySubjectRepository.create({ userId, name: "Matemática" })
    ).rejects.toThrow();
  });

  it("tarefa concluída registra completed_at", async () => {
    const userId = await createTestUser();
    users.push(userId);

    const task = await StudyTaskRepository.create({
      userId,
      title: "Fazer questões",
      scheduledDate: new Date(),
      durationMin: 30,
      status: "pendente",
    });
    const done = await StudyTaskRepository.complete(task.id, userId);
    expect(done?.status).toBe("concluida");
    expect(done?.completedAt).toBeTruthy();
  });
});
