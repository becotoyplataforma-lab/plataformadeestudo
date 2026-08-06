/**
 * Testes do AggregationService (Analytics) — agregação sob demanda.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListAttempts = vi.fn();
const mockListAttemptsBySubject = vi.fn();
const mockListTasks = vi.fn();
const mockCountReviewsDue = vi.fn();
const mockListUsage = vi.fn();
const mockGetProfileMeta = vi.fn();

vi.mock("../../repositories/aggregation.repository", () => ({
  AggregationRepository: {
    listAttempts: (...args: unknown[]) => mockListAttempts(...args),
    listAttemptsBySubject: (...args: unknown[]) => mockListAttemptsBySubject(...args),
    listTasks: (...args: unknown[]) => mockListTasks(...args),
    countReviewsDue: (...args: unknown[]) => mockCountReviewsDue(...args),
    listUsage: (...args: unknown[]) => mockListUsage(...args),
    listActivityTimestamps: vi.fn(),
    getProfileMeta: (...args: unknown[]) => mockGetProfileMeta(...args),
  },
}));

const mockGetStreak = vi.fn();
vi.mock("../streak.service", () => ({
  StreakService: { getStreak: (...args: unknown[]) => mockGetStreak(...args) },
}));

import { AggregationService } from "../aggregation.service";

const UUID_A = "00000000-0000-0000-0000-00000000000a";
const UUID_B = "00000000-0000-0000-0000-00000000000b";

function attempt(isCorrect: boolean, createdAt = new Date()) {
  return { isCorrect, createdAt };
}

function task(overrides: Partial<{ status: string; durationMin: number; scheduledDate: Date; completedAt: Date | null }> = {}) {
  return {
    scheduledDate: new Date(),
    status: "pendente",
    durationMin: 30,
    completedAt: null,
    ...overrides,
  };
}

describe("AggregationService.getSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAttempts.mockResolvedValue([]);
    mockListTasks.mockResolvedValue([]);
    mockCountReviewsDue.mockResolvedValue(0);
    mockListUsage.mockResolvedValue([]);
    mockGetProfileMeta.mockResolvedValue(null);
    mockGetStreak.mockResolvedValue({ current: 0, needsToday: true });
  });

  it("retorna zeros quando não há dados", async () => {
    const s = await AggregationService.getSummary("u1", "2026-08-05");
    expect(s).toMatchObject({
      totalQuestions: 0,
      correctAnswers: 0,
      accuracyPct: 0,
      streakDays: 0,
      metaTodayMin: 120,
      studiedTodayMin: 0,
      pendingReviews: 0,
      tasksToday: 0,
      aiMessagesToday: 0,
    });
  });

  it("calcula total, acertos e taxa de acerto", async () => {
    mockListAttempts.mockResolvedValue([
      attempt(true),
      attempt(true),
      attempt(false),
    ]);
    const s = await AggregationService.getSummary("u1", "2026-08-05");
    expect(s.totalQuestions).toBe(3);
    expect(s.correctAnswers).toBe(2);
    expect(s.accuracyPct).toBeCloseTo(66.7, 1);
  });

  it("contabiliza tarefas do dia e minutos estudados", async () => {
    mockListTasks.mockResolvedValue([
      task({ status: "concluida", durationMin: 45 }),
      task({ status: "concluida", durationMin: 15 }),
      task({ status: "pendente", durationMin: 60 }),
    ]);
    const s = await AggregationService.getSummary("u1", "2026-08-05");
    expect(s.tasksToday).toBe(3);
    expect(s.tasksCompletedToday).toBe(2);
    expect(s.studiedTodayMin).toBe(60);
  });

  it("agrega revisões pendentes e mensagens de IA do dia", async () => {
    mockCountReviewsDue.mockResolvedValue(7);
    mockListUsage.mockResolvedValue([{ usageDate: new Date(), messagesCount: 4 }]);
    const s = await AggregationService.getSummary("u1", "2026-08-05");
    expect(s.pendingReviews).toBe(7);
    expect(s.aiMessagesToday).toBe(4);
  });

  it("usa a meta diária do perfil quando existir", async () => {
    mockGetProfileMeta.mockResolvedValue({ metaDiariaMin: 180 });
    const s = await AggregationService.getSummary("u1", "2026-08-05");
    expect(s.metaTodayMin).toBe(180);
  });

  it("propaga o streak do StreakService", async () => {
    mockGetStreak.mockResolvedValue({ current: 5, needsToday: false });
    const s = await AggregationService.getSummary("u1", "2026-08-05");
    expect(s.streakDays).toBe(5);
    expect(s.streakNeedsToday).toBe(false);
  });
});

describe("AggregationService.getPerformanceBySubject", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna piores matérias primeiro", async () => {
    mockListAttemptsBySubject.mockResolvedValue([
      { subjectId: UUID_A, subjectName: "Direito", total: 10, correct: 8 },
      { subjectId: UUID_B, subjectName: "Matemática", total: 10, correct: 2 },
    ]);
    const rows = await AggregationService.getPerformanceBySubject("u1");
    expect(rows[0].subjectName).toBe("Matemática");
    expect(rows[0].accuracyPct).toBe(20);
    expect(rows[1].accuracyPct).toBe(80);
  });

  it("taxa 0 quando não há tentativas na matéria", async () => {
    mockListAttemptsBySubject.mockResolvedValue([
      { subjectId: UUID_A, subjectName: "Direito", total: 0, correct: 0 },
    ]);
    const rows = await AggregationService.getPerformanceBySubject("u1");
    expect(rows[0].accuracyPct).toBe(0);
  });
});

describe("AggregationService.getEvolution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preenche N dias e agrupa tentativas por dia", async () => {
    mockListAttempts.mockResolvedValue([attempt(true, new Date())]);
    const points = await AggregationService.getEvolution("u1", 7);
    expect(points).toHaveLength(7);
    expect(points[6].total).toBe(1);
    expect(points[6].correct).toBe(1);
  });

  it("dias sem tentativas ficam zerados", async () => {
    mockListAttempts.mockResolvedValue([]);
    const points = await AggregationService.getEvolution("u1", 3);
    expect(points).toHaveLength(3);
    expect(points.every((p) => p.total === 0)).toBe(true);
  });
});

describe("AggregationService.getStudyTime", () => {
  beforeEach(() => vi.clearAllMocks());

  it("soma minutos das tarefas concluídas por dia", async () => {
    mockListTasks.mockResolvedValue([
      task({ status: "concluida", durationMin: 40, scheduledDate: new Date() }),
      task({ status: "concluida", durationMin: 20, scheduledDate: new Date() }),
      task({ status: "pendente", durationMin: 90, scheduledDate: new Date() }),
    ]);
    const points = await AggregationService.getStudyTime("u1", 7);
    expect(points).toHaveLength(7);
    expect(points[6].minutes).toBe(60);
  });

  it("ignora tarefas não concluídas", async () => {
    mockListTasks.mockResolvedValue([
      task({ status: "adiada", durationMin: 90, scheduledDate: new Date() }),
    ]);
    const points = await AggregationService.getStudyTime("u1", 1);
    expect(points[0].minutes).toBe(0);
  });
});

describe("AggregationService.getDistribution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calcula percentuais por matéria", async () => {
    mockListAttemptsBySubject.mockResolvedValue([
      { subjectId: UUID_A, subjectName: "Direito", total: 75, correct: 50 },
      { subjectId: UUID_B, subjectName: "Matemática", total: 25, correct: 20 },
    ]);
    const rows = await AggregationService.getDistribution("u1");
    expect(rows).toHaveLength(2);
    expect(rows[0].percent).toBe(75);
    expect(rows[1].percent).toBe(25);
  });

  it("retorna vazio sem dados", async () => {
    mockListAttemptsBySubject.mockResolvedValue([]);
    await expect(AggregationService.getDistribution("u1")).resolves.toEqual([]);
  });
});

describe("AggregationService.getScheduleProgress", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calcula aderência (concluídas / planejadas)", async () => {
    mockListTasks.mockResolvedValue([
      task({ status: "concluida" }),
      task({ status: "concluida" }),
      task({ status: "pendente" }),
      task({ status: "adiada" }),
    ]);
    const p = await AggregationService.getScheduleProgress("u1", 7);
    expect(p.scheduled).toBe(4);
    expect(p.completed).toBe(2);
    expect(p.adherencePct).toBe(50);
  });

  it("aderência 0 sem tarefas", async () => {
    mockListTasks.mockResolvedValue([]);
    const p = await AggregationService.getScheduleProgress("u1", 7);
    expect(p).toEqual({ scheduled: 0, completed: 0, adherencePct: 0 });
  });
});
