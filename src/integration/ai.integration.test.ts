/**
 * FASE 18 — Integração real: AI (ChatRepository, UsageRepository no Postgres real).
 */
import { describe, it, expect, afterAll } from "vitest";
import { ChatRepository } from "@/lib/ai/repositories/chat.repository";
import { UsageRepository } from "@/lib/ai/repositories/usage.repository";
import { hasDb, createTestUser, deleteTestUser, startOfDay } from "./helpers";

describe.skipIf(!hasDb)("AI — integração real", () => {
  const users: string[] = [];

  afterAll(async () => {
    await Promise.all(users.map((id) => deleteTestUser(id)));
  });

  it("cria sessão, mensagens e lê contexto recente", async () => {
    const userId = await createTestUser();
    users.push(userId);

    const session = await ChatRepository.createSession({
      userId,
      title: "Sessão teste",
      model: "flash",
    });

    await ChatRepository.createMessage({
      sessionId: session.id,
      userId,
      role: "user",
      content: "Oi",
      tokensIn: 0,
      tokensOut: 0,
    });
    await ChatRepository.createMessage({
      sessionId: session.id,
      userId,
      role: "assistant",
      content: "Olá!",
      model: "flash",
      tokensIn: 10,
      tokensOut: 5,
    });

    const recent = await ChatRepository.getRecentContext(session.id, 10);
    expect(recent.length).toBeGreaterThanOrEqual(2);
    // getRecentContext retorna do mais recente para o mais antigo.
    expect(recent[0].role).toBe("assistant");
    const roles = recent.map((m) => m.role);
    expect(roles).toContain("user");
    expect(roles).toContain("assistant");
  });

  it("registra e acumula ai_usage por dia (upsert)", async () => {
    const userId = await createTestUser();
    users.push(userId);
    const day = startOfDay();

    await UsageRepository.increment(userId, day, 10, 5);
    await UsageRepository.increment(userId, day, 20, 10);

    const row = await UsageRepository.findByUserAndDay(userId, day);
    expect(row?.messagesCount).toBe(2);
    expect(row?.tokensIn).toBe(30);
    expect(row?.tokensOut).toBe(15);
  });
});
