/**
 * FASE 18 — Integração real: Analytics (AggregationService contra dados reais
 * de Study no Postgres real).
 */
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { db } from "@/lib/db/drizzle";
import { questions, questionAttempts, studyTasks } from "@/db/schema/study";
import { AggregationService } from "@/lib/analytics/services/aggregation.service";
import { hasDb, createTestUser, deleteTestUser, createTestSubject, deleteTestSubject } from "./helpers";

describe.skipIf(!hasDb)("Analytics — integração real", () => {
  const users: string[] = [];
  const subjects: string[] = [];
  let userId: string;

  beforeAll(async () => {
    if (!hasDb) return;
    userId = await createTestUser();
    users.push(userId);

    // Matéria e questão de teste precisam do mesmo registro de limpeza que o
    // usuário: `knowledge_subjects` e `questions` não têm `user_id`, e sem isto
    // cada execução deixa catálogo órfão publicado para o aluno ver.
    const subjectId = await createTestSubject(
      `Matéria ${userId.slice(0, 8)}`,
      `materia-${userId.slice(0, 8)}`
    );
    subjects.push(subjectId);

    const [question] = await db
      .insert(questions)
      .values({
        knowledgeSubjectId: subjectId,
        nivel: "medio",
        enunciado: "Qual é a pergunta?",
        gabarito: "A",
        status: "publicada",
        isPublic: true,
      })
      .returning();

    await db.insert(questionAttempts).values([
      { userId, questionId: question.id, selectedLetter: "A", isCorrect: true },
      { userId, questionId: question.id, selectedLetter: "B", isCorrect: false },
    ]);

    await db.insert(studyTasks).values({
      userId,
      title: "Tarefa concluída",
      scheduledDate: new Date(),
      durationMin: 45,
      status: "concluida",
      completedAt: new Date(),
    });
  });

  afterAll(async () => {
    await Promise.all(users.map((id) => deleteTestUser(id)));
    await Promise.all(subjects.map((id) => deleteTestSubject(id)));
  });

  it("resumo agrega tentativas, taxa e tempo de estudo", async () => {
    const summary = await AggregationService.getSummary(userId);
    expect(summary.totalQuestions).toBe(2);
    expect(summary.correctAnswers).toBe(1);
    expect(summary.accuracyPct).toBe(50);
    expect(summary.studiedTodayMin).toBe(45);
    expect(summary.tasksCompletedToday).toBe(1);
  });

  it("evolução agrega por dia", async () => {
    const evolution = await AggregationService.getEvolution(userId, 7);
    expect(evolution).toHaveLength(7);
    expect(evolution[6].total).toBe(2);
    expect(evolution[6].correct).toBe(1);
  });

  it("desempenho por matéria inclui a matéria criada", async () => {
    const rows = await AggregationService.getPerformanceBySubject(userId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].total).toBe(2);
  });
});
