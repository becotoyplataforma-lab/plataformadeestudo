/**
 * Testes das API routes /api/analytics/*.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

const mockGetSummary = vi.fn();
const mockGetPerformance = vi.fn();
const mockGetEvolution = vi.fn();
const mockGetStudyTime = vi.fn();
const mockGetDistribution = vi.fn();
const mockGetSchedule = vi.fn();
vi.mock("@/lib/analytics/services/aggregation.service", () => ({
  AggregationService: {
    getSummary: (...a: unknown[]) => mockGetSummary(...a),
    getPerformanceBySubject: (...a: unknown[]) => mockGetPerformance(...a),
    getEvolution: (...a: unknown[]) => mockGetEvolution(...a),
    getStudyTime: (...a: unknown[]) => mockGetStudyTime(...a),
    getDistribution: (...a: unknown[]) => mockGetDistribution(...a),
    getScheduleProgress: (...a: unknown[]) => mockGetSchedule(...a),
  },
}));

const mockGetForDay = vi.fn();
vi.mock("@/lib/analytics/services/daily-summary.service", () => ({
  DailySummaryService: {
    getForDay: (...a: unknown[]) => mockGetForDay(...a),
  },
}));

import { GET as getSummary } from "@/app/api/analytics/summary/route";
import { GET as getSubjects } from "@/app/api/analytics/subjects/route";
import { GET as getEvolution } from "@/app/api/analytics/evolution/route";
import { GET as getStudyTime } from "@/app/api/analytics/study-time/route";
import { GET as getDistribution } from "@/app/api/analytics/distribution/route";
import { GET as getSchedule } from "@/app/api/analytics/schedule/route";
import { GET as getDailySummary } from "@/app/api/analytics/daily-summary/route";

const UUID = "00000000-0000-0000-0000-000000000001";

function summaryMock() {
  return {
    totalQuestions: 10,
    correctAnswers: 7,
    accuracyPct: 70,
    streakDays: 3,
    streakNeedsToday: true,
    metaTodayMin: 120,
    studiedTodayMin: 45,
    pendingReviews: 4,
    tasksToday: 5,
    tasksCompletedToday: 2,
    aiMessagesToday: 6,
  };
}

describe("GET /api/analytics/*", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockGetSummary.mockResolvedValue(summaryMock());
    mockGetPerformance.mockResolvedValue([]);
    mockGetEvolution.mockResolvedValue([]);
    mockGetStudyTime.mockResolvedValue([]);
    mockGetDistribution.mockResolvedValue([]);
    mockGetSchedule.mockResolvedValue({ scheduled: 0, completed: 0, adherencePct: 0 });
    mockGetForDay.mockResolvedValue(null);
  });

  it("retorna 401 sem autenticação", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await getSummary();
    expect(res.status).toBe(401);
  });

  it("summary retorna 200 com KPIs", async () => {
    const res = await getSummary();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { total_questoes: number; taxa_acerto: number };
    expect(json.total_questoes).toBe(10);
    expect(json.taxa_acerto).toBe(70);
  });

  it("subjects retorna 200 com lista", async () => {
    const res = await getSubjects();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: unknown[] };
    expect(json.data).toEqual([]);
  });

  it("evolution respeita o parâmetro days", async () => {
    await getEvolution(new NextRequest("http://localhost/api/analytics/evolution?days=14"));
    expect(mockGetEvolution).toHaveBeenCalledWith("u1", 14);
  });

  it("evolution usa default 30 quando sem days", async () => {
    await getEvolution(new NextRequest("http://localhost/api/analytics/evolution"));
    expect(mockGetEvolution).toHaveBeenCalledWith("u1", 30);
  });

  it("study-time respeita o parâmetro days", async () => {
    await getStudyTime(new NextRequest("http://localhost/api/analytics/study-time?days=7"));
    expect(mockGetStudyTime).toHaveBeenCalledWith("u1", 7);
  });

  it("distribution retorna 200 com lista", async () => {
    const res = await getDistribution();
    expect(res.status).toBe(200);
  });

  it("schedule retorna 200 com progresso", async () => {
    const res = await getSchedule(
      new NextRequest("http://localhost/api/analytics/schedule")
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { aderencia: number };
    expect(json.aderencia).toBe(0);
  });

  it("daily-summary retorna data null quando não materializado", async () => {
    const res = await getDailySummary(
      new NextRequest("http://localhost/api/analytics/daily-summary?date=2026-08-05")
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: unknown };
    expect(json.data).toBeNull();
  });

  it("daily-summary retorna o resumo quando materializado", async () => {
    mockGetForDay.mockResolvedValue({
      id: UUID,
      userId: UUID,
      summaryDate: new Date(),
      totalQuestions: 10,
      correctAnswers: 7,
      studyMinutes: 60,
      reviewsDone: 5,
      aiMessages: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await getDailySummary(
      new NextRequest("http://localhost/api/analytics/daily-summary?date=2026-08-05")
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { total_questions: number } };
    expect(json.data.total_questions).toBe(10);
  });
});
