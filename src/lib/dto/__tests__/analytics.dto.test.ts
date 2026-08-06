/**
 * Testes dos DTOs do Analytics — validação Zod e mappers.
 */
import { describe, it, expect } from "vitest";
import {
  SummaryDtoSchema,
  SubjectPerformanceDtoSchema,
  EvolutionPointDtoSchema,
  StudyTimePointDtoSchema,
  DistributionPointDtoSchema,
  ScheduleProgressDtoSchema,
  DailySummaryDtoSchema,
  EventLogDtoSchema,
  mapSummaryToDto,
  mapSubjectPerfToDto,
  mapEvolutionToDto,
  mapStudyTimeToDto,
  mapDistributionToDto,
  mapScheduleToDto,
  mapDailySummaryToDto,
  mapEventLogToDto,
} from "@/lib/dto/analytics.dto";

const UUID = "00000000-0000-0000-0000-000000000001";

describe("SummaryDtoSchema", () => {
  const summary = {
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

  it("aceita resumo válido", () => {
    const dto = mapSummaryToDto(summary);
    const parsed = SummaryDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.total_questoes).toBe(10);
      expect(parsed.data.taxa_acerto).toBe(70);
    }
  });

  it("rejeita taxa fora de 0-100", () => {
    const dto = mapSummaryToDto(summary);
    expect(
      SummaryDtoSchema.safeParse({ ...dto, taxa_acerto: 150 }).success
    ).toBe(false);
  });

  it("rejeita contador negativo", () => {
    const dto = mapSummaryToDto(summary);
    expect(
      SummaryDtoSchema.safeParse({ ...dto, total_questoes: -1 }).success
    ).toBe(false);
  });
});

describe("SubjectPerformanceDtoSchema", () => {
  it("aceita e mapeia desempenho", () => {
    const dto = mapSubjectPerfToDto({
      subjectId: UUID,
      subjectName: "Direito",
      total: 10,
      correct: 8,
      accuracyPct: 80,
    });
    const parsed = SubjectPerformanceDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.taxa).toBe(80);
  });
});

describe("EvolutionPointDtoSchema", () => {
  it("aceita e mapeia ponto de evolução", () => {
    const dto = mapEvolutionToDto({
      date: "2026-08-05",
      total: 5,
      correct: 3,
      accuracyPct: 60,
    });
    expect(EvolutionPointDtoSchema.safeParse(dto).success).toBe(true);
  });
});

describe("StudyTimePointDtoSchema", () => {
  it("aceita e mapeia tempo de estudo", () => {
    const dto = mapStudyTimeToDto({ date: "2026-08-05", minutes: 45 });
    expect(StudyTimePointDtoSchema.safeParse(dto).success).toBe(true);
  });
});

describe("DistributionPointDtoSchema", () => {
  it("aceita e mapeia distribuição", () => {
    const dto = mapDistributionToDto({
      subjectId: UUID,
      subjectName: "Direito",
      total: 75,
      percent: 75,
    });
    const parsed = DistributionPointDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.percentual).toBe(75);
  });
});

describe("ScheduleProgressDtoSchema", () => {
  it("aceita e mapeia progresso", () => {
    const dto = mapScheduleToDto({ scheduled: 4, completed: 2, adherencePct: 50 });
    const parsed = ScheduleProgressDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.planejadas).toBe(4);
      expect(parsed.data.aderencia).toBe(50);
    }
  });
});

describe("DailySummaryDtoSchema", () => {
  it("aceita e mapeia resumo materializado", () => {
    const row = {
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
    };
    const dto = mapDailySummaryToDto(row);
    const parsed = DailySummaryDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.correct_answers).toBe(7);
  });
});

describe("EventLogDtoSchema", () => {
  it("aceita e mapeia evento", () => {
    const row = {
      id: UUID,
      userId: UUID,
      entityType: "study",
      entityId: UUID,
      eventName: "question.answered",
      payload: { is_correct: true },
      occurredAt: new Date(),
      createdAt: new Date(),
    };
    const dto = mapEventLogToDto(row);
    const parsed = EventLogDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.event_name).toBe("question.answered");
  });
});
