/**
 * Testes do DailySummaryService e EventLogService (Analytics).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindByUserAndDate = vi.fn();
const mockListByUserInRange = vi.fn();
const mockUpsert = vi.fn();
vi.mock("../../repositories/daily-summary.repository", () => ({
  DailySummaryRepository: {
    findByUserAndDate: (...args: unknown[]) => mockFindByUserAndDate(...args),
    listByUserInRange: (...args: unknown[]) => mockListByUserInRange(...args),
    upsert: (...args: unknown[]) => mockUpsert(...args),
  },
}));

const mockCreateEvent = vi.fn();
const mockFindByUser = vi.fn();
const mockFindByEntity = vi.fn();
vi.mock("../../repositories/event-log.repository", () => ({
  EventLogRepository: {
    create: (...args: unknown[]) => mockCreateEvent(...args),
    findByUser: (...args: unknown[]) => mockFindByUser(...args),
    findByEntity: (...args: unknown[]) => mockFindByEntity(...args),
  },
}));

import { DailySummaryService } from "../daily-summary.service";
import { EventLogService } from "../event-log.service";

const ROW = {
  id: "00000000-0000-0000-0000-000000000001",
  userId: "00000000-0000-0000-0000-000000000002",
  summaryDate: new Date(),
  totalQuestions: 10,
  correctAnswers: 7,
  studyMinutes: 60,
  reviewsDone: 5,
  aiMessages: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("DailySummaryService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getForDay retorna o resumo do dia", async () => {
    mockFindByUserAndDate.mockResolvedValue(ROW);
    const row = await DailySummaryService.getForDay("u1", new Date());
    expect(row).toEqual(ROW);
    expect(mockFindByUserAndDate).toHaveBeenCalledTimes(1);
  });

  it("getForDay retorna null quando não materializado", async () => {
    mockFindByUserAndDate.mockResolvedValue(null);
    await expect(DailySummaryService.getForDay("u1", new Date())).resolves.toBeNull();
  });

  it("getRange lista resumos do intervalo", async () => {
    mockListByUserInRange.mockResolvedValue([ROW]);
    const rows = await DailySummaryService.getRange("u1", new Date(), new Date());
    expect(rows).toHaveLength(1);
  });
});

describe("EventLogService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("record persiste um evento imutável", async () => {
    mockCreateEvent.mockResolvedValue({ id: "e1" });
    await EventLogService.record({
      userId: "u1",
      entityType: "study",
      entityId: "q1",
      eventName: "question.answered",
      payload: { is_correct: true },
    });
    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        entityType: "study",
        eventName: "question.answered",
        occurredAt: expect.any(Date),
      })
    );
  });

  it("record sem userId persiste null", async () => {
    mockCreateEvent.mockResolvedValue({ id: "e1" });
    await EventLogService.record({ entityType: "system", eventName: "health" });
    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, eventName: "health" })
    );
  });

  it("listByUser consulta eventos do usuário", async () => {
    mockFindByUser.mockResolvedValue([{ id: "e1" }]);
    const rows = await EventLogService.listByUser("u1", 10);
    expect(rows).toHaveLength(1);
    expect(mockFindByUser).toHaveBeenCalledWith("u1", 10);
  });

  it("listByEntity consulta por entidade", async () => {
    mockFindByEntity.mockResolvedValue([{ id: "e1" }]);
    await EventLogService.listByEntity("study", "q1");
    expect(mockFindByEntity).toHaveBeenCalledWith("study", "q1", 50);
  });
});
