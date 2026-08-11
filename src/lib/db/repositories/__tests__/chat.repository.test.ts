import { describe, expect, it, vi } from "vitest";
import { createSession } from "@/lib/db/repositories/chat";

describe("chat repository", () => {
  it("usa o campo knowledge_subject_id ao criar uma sessão", async () => {
    const db = {
      from: vi.fn(() => ({
        insert: vi.fn((payload) => {
          expect(payload).toMatchObject({
            user_id: "user-1",
            title: "Teste",
            knowledge_subject_id: "subject-1",
            model: "flash",
          });
          expect(payload).not.toHaveProperty("subject_id");

          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: "session-1",
                  user_id: "user-1",
                  title: "Teste",
                  knowledge_subject_id: "subject-1",
                  model: "flash",
                },
                error: null,
              }),
            }),
          };
        }),
      })),
    } as any;

    const result = await createSession(db, "user-1", {
      title: "Teste",
      subject_id: "subject-1",
      model: "flash",
    });

    expect(result.knowledge_subject_id).toBe("subject-1");
  });
});
