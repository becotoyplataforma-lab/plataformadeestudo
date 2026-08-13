import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSession } from "@/lib/db/repositories/chat";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
}));

vi.mock("@/lib/db/drizzle", () => ({
  db: { insert: mocks.insert },
}));

describe("chat repository", () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.insert.mockImplementation(() => ({
      values: (payload: unknown) => {
        expect(payload).toMatchObject({
          userId: "user-1",
          title: "Teste",
          knowledgeSubjectId: "subject-1",
          model: "flash",
        });
        expect(payload).not.toHaveProperty("subjectId");
        return {
          returning: async () => [
            {
              id: "session-1",
              userId: "user-1",
              title: "Teste",
              knowledgeSubjectId: "subject-1",
              model: "flash",
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              deletedAt: null,
            },
          ],
        };
      },
    }));
  });

  it("usa o campo knowledge_subject_id ao criar uma sessão", async () => {
    const result = await createSession("user-1", {
      title: "Teste",
      subject_id: "subject-1",
      model: "flash",
    });

    expect(result.knowledge_subject_id).toBe("subject-1");
  });
});
