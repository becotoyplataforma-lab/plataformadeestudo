/**
 * FASE 18 — E2E dos fluxos principais contra o Postgres real.
 *
 * Fluxo 1: Study → Analytics (questões + tarefas geram métricas).
 * Fluxo 2: Professor IA → Billing (entitlement) → AI Usage (registro).
 * Única fronteira externa mockada: HTTP DeepSeek.
 */
import { describe, it, expect, vi, afterAll } from "vitest";
import { db } from "@/lib/db/drizzle";
import { questions, questionAttempts, studyTasks } from "@/db/schema/study";
import { knowledgeSubjects } from "@/db/schema/knowledge";

const mockChatCompletion = vi.fn();
vi.mock("@/lib/ai/deepseek", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/deepseek")>();
  return {
    ...actual,
    chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
  };
});

import { ProfessorService, defaultResolveIntent } from "@/lib/ai/services/professor.service";
import { RagService } from "@/lib/ai/services/rag.service";
import { ChatService } from "@/lib/ai/services/chat.service";
import { PromptService } from "@/lib/ai/services/prompt.service";
import { DeepSeekProvider } from "@/lib/ai/services/deepseek-provider.service";
import { ModelRouterService } from "@/lib/ai/services/model-router.service";
import { UsageService } from "@/lib/ai/services/usage.service";
import { HybridSearchService } from "@/lib/knowledge/services/hybrid-search.service";
import { EntitlementService } from "@/lib/billing/services/entitlement.service";
import { AggregationService } from "@/lib/analytics/services/aggregation.service";
import { UsageRepository } from "@/lib/ai/repositories/usage.repository";
import { hasDb, createTestUser, deleteTestUser, startOfDay } from "./helpers";

describe.skipIf(!hasDb)("E2E — fluxos principais (Postgres real)", () => {
  const users: string[] = [];

  afterAll(async () => {
    await Promise.all(users.map((id) => deleteTestUser(id)));
  });

  it("fluxo Study → Analytics: responder questões e concluir tarefa gera KPIs", async () => {
    const userId = await createTestUser();
    users.push(userId);

    const [subject] = await db
      .insert(knowledgeSubjects)
      .values({ name: `E2E ${userId.slice(0, 8)}`, slug: `e2e-${userId.slice(0, 8)}` })
      .returning();
    const [question] = await db
      .insert(questions)
      .values({ knowledgeSubjectId: subject.id, nivel: "facil", enunciado: "P?", gabarito: "A", status: "publicada", isPublic: true })
      .returning();
    await db.insert(questionAttempts).values({ userId, questionId: question.id, selectedLetter: "A", isCorrect: true });
    await db.insert(studyTasks).values({ userId, title: "Estudar", scheduledDate: new Date(), durationMin: 30, status: "concluida", completedAt: new Date() });

    const summary = await AggregationService.getSummary(userId);
    expect(summary.totalQuestions).toBe(1);
    expect(summary.correctAnswers).toBe(1);
    expect(summary.studiedTodayMin).toBe(30);
    expect(summary.streakDays).toBeGreaterThanOrEqual(1);
  });

  it("fluxo Professor IA → Billing → AI Usage: chat consulta entitlement e registra uso", async () => {
    const userId = await createTestUser();
    users.push(userId);
    mockChatCompletion.mockResolvedValue({ content: "Resposta E2E", model: "flash", tokensIn: 8, tokensOut: 4 });

    const professor = new ProfessorService({
      rag: new RagService({ search: HybridSearchService, prompt: PromptService, provider: DeepSeekProvider, router: ModelRouterService }),
      chat: ChatService,
      usage: UsageService,
      router: ModelRouterService,
      resolveIntent: defaultResolveIntent,
      billing: EntitlementService,
    });

    const out = await professor.ask({ message: "O que estudar hoje?", userId });
    expect(out.mode).toBe("chat");
    expect(out.answer).toBe("Resposta E2E");

    const usage = await UsageRepository.findByUserAndDay(userId, startOfDay());
    expect(usage?.messagesCount).toBe(1);

    const analytics = await AggregationService.getSummary(userId);
    expect(analytics.aiMessagesToday).toBe(1);
  });
});
