import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listFlashcards,
  createFlashcard,
  deleteFlashcard,
  recordReview,
  countDue,
} from "@/lib/db/repositories/flashcards";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  review: vi.fn(),
  countDue: vi.fn(),
}));

vi.mock("@/lib/study/services/flashcard.service", () => ({
  FlashcardService: {
    list: mocks.list,
    create: mocks.create,
    delete: mocks.delete,
  },
}));

vi.mock("@/lib/study/services/review-schedule.service", () => ({
  ReviewScheduleService: {
    review: mocks.review,
  },
}));

vi.mock("@/lib/study/repositories/review-schedule.repository", () => ({
  ReviewScheduleRepository: {
    countDue: mocks.countDue,
  },
}));

describe("flashcards repository (legado → Drizzle)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listFlashcards mapeia linhas Drizzle para o contrato legado", async () => {
    mocks.list.mockResolvedValue([
      {
        id: "fc-1",
        userId: "user-1",
        studySubjectId: "sub-1",
        subjectName: "Direito",
        subjectColor: "#ff0000",
        front: "Pergunta",
        back: "Resposta",
        tags: ["a"],
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        intervalDays: 3,
        dueDate: new Date("2026-08-04T00:00:00.000Z"),
      },
    ]);

    const cards = await listFlashcards("user-1", { subject_id: "sub-1", onlyDue: true });

    expect(mocks.list).toHaveBeenCalledWith("user-1", {
      studySubjectId: "sub-1",
      onlyDue: true,
    });
    expect(cards[0]).toMatchObject({
      id: "fc-1",
      user_id: "user-1",
      subject_id: "sub-1",
      front: "Pergunta",
      back: "Resposta",
      tags: ["a"],
      subject: { id: "sub-1", name: "Direito", color: "#ff0000" },
      schedule: { due_date: "2026-08-04", interval_days: 3 },
    });
  });

  it("listFlashcards retorna lista vazia quando não há registros", async () => {
    mocks.list.mockResolvedValue([]);
    await expect(listFlashcards("user-1")).resolves.toEqual([]);
  });

  it("createFlashcard associa ao userId e mapeia sem schedule", async () => {
    mocks.create.mockResolvedValue({
      id: "fc-2",
      userId: "user-1",
      studySubjectId: "sub-1",
      front: "P",
      back: "R",
      tags: [],
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
      deletedAt: null,
    });

    const card = await createFlashcard("user-1", {
      front: "P",
      back: "R",
      subject_id: "sub-1",
      tags: [],
    });

    expect(mocks.create).toHaveBeenCalledWith("user-1", {
      studySubjectId: "sub-1",
      front: "P",
      back: "R",
      tags: [],
    });
    expect(card.subject_id).toBe("sub-1");
    expect(card.schedule).toBeNull();
  });

  it("deleteFlashcard delega com userId", async () => {
    mocks.delete.mockResolvedValue(undefined);
    await deleteFlashcard("user-1", "fc-1");
    expect(mocks.delete).toHaveBeenCalledWith("user-1", "fc-1");
  });

  it("recordReview devolve next_review e interval_days", async () => {
    mocks.review.mockResolvedValue({
      scheduleId: "s1",
      intervalDays: 6,
      easeFactor: 2.5,
      repetitions: 1,
      dueDate: new Date("2026-08-07T00:00:00.000Z"),
    });

    const r = await recordReview("user-1", { flashcard_id: "fc-1", rating: "medio" });

    expect(mocks.review).toHaveBeenCalledWith("user-1", "fc-1", "medio");
    expect(r).toEqual({ next_review: "2026-08-07", interval_days: 6 });
  });

  it("countDue delega ao repositório", async () => {
    mocks.countDue.mockResolvedValue(2);
    await expect(countDue("user-1")).resolves.toBe(2);
    expect(mocks.countDue).toHaveBeenCalledWith("user-1");
  });
});
