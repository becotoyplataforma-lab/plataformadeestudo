/**
 * E2E — Flashcards (fluxo completo via API real).
 *
 * 1) Autentica
 * 2) POST /api/flashcards → cria card (201)
 * 3) GET /api/flashcards → verifica que aparece na lista
 * 4) POST /api/flashcards/review → registra revisão SRS (200)
 * 5) DELETE /api/flashcards/:id → remove (sem poluir dados do usuário)
 *
 * Requer E2E_USER_EMAIL / E2E_USER_PASSWORD (backend real).
 */
import { test, expect } from "@playwright/test";
import { getAuthContext, hasAuth } from "./support/auth";

test.describe("Flashcards — fluxo principal", () => {
  test.skip(!hasAuth, "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD (backend real)");

  test("cria → lista → revisa → remove flashcard", async () => {
    const api = await getAuthContext();
    const suffix = Date.now();

    // 1) Cria
    const created = await api.post("/api/flashcards", {
      data: {
        front: `E2E pergunta ${suffix}`,
        back: `E2E resposta ${suffix}`,
        tags: ["e2e"],
      },
    });
    expect(created.ok()).toBeTruthy();
    const createdBody = (await created.json()) as {
      data?: { id: string; front: string; back: string };
    };
    const cardId = createdBody.data?.id;
    expect(cardId).toBeTruthy();
    expect(createdBody.data?.front).toBe(`E2E pergunta ${suffix}`);

    // 2) Lista — deve conter o card recém-criado
    const listed = await api.get("/api/flashcards");
    expect(listed.ok()).toBeTruthy();
    const listedBody = (await listed.json()) as {
      data?: Array<{ id: string; front: string }>;
    };
    const found = (listedBody.data ?? []).some((c) => c.id === cardId);
    expect(found).toBe(true);

    // 3) Revisão SRS
    const reviewed = await api.post("/api/flashcards/review", {
      data: { flashcard_id: cardId, rating: "facil" },
    });
    expect(reviewed.ok()).toBeTruthy();
    const reviewBody = (await reviewed.json()) as {
      due_today_left?: number;
    };
    expect(typeof reviewBody.due_today_left).toBe("number");

    // 4) Remove (cleanup — não acumula dados de teste)
    const removed = await api.delete(`/api/flashcards/${cardId}`);
    expect(removed.ok()).toBeTruthy();

    // 5) Confirma remoção
    const after = await api.get("/api/flashcards");
    const afterBody = (await after.json()) as {
      data?: Array<{ id: string }>;
    };
    expect((afterBody.data ?? []).some((c) => c.id === cardId)).toBe(false);

    await api.dispose();
  });
});
