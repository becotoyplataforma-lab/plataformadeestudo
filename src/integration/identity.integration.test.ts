/**
 * FASE 18 — Integração real: Identity (schema/constraints no Postgres real).
 */
import { describe, it, expect, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { profiles, sessions } from "@/db/schema/identity";
import { hasDb, createTestUser, deleteTestUser } from "./helpers";

describe.skipIf(!hasDb)("Identity — integração real", () => {
  const users: string[] = [];

  afterAll(async () => {
    await Promise.all(users.map((id) => deleteTestUser(id)));
  });

  it("cria profile (1:1) e sessão e lê de volta", async () => {
    const userId = await createTestUser();
    users.push(userId);

    await db.insert(profiles).values({
      id: userId,
      fullName: "Teste Integração",
      metaDiariaMin: 90,
    });
    await db.insert(sessions).values({
      userId,
      token: `tok-${userId}`,
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    expect(profile.fullName).toBe("Teste Integração");
    expect(profile.metaDiariaMin).toBe(90);

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .limit(1);
    expect(session.token).toBe(`tok-${userId}`);
  });

  it("rejeita meta diária fora da faixa (CHECK chk_profiles_meta_diaria)", async () => {
    const userId = await createTestUser();
    users.push(userId);

    await expect(
      db.insert(profiles).values({ id: userId, metaDiariaMin: 5 })
    ).rejects.toThrow();
  });

  it("sessão com token duplicado ativo é rejeitada (índice parcial)", async () => {
    const userId = await createTestUser();
    users.push(userId);
    const expiresAt = new Date(Date.now() + 3_600_000);

    await db.insert(sessions).values({ userId, token: "dup", expiresAt });
    await expect(
      db.insert(sessions).values({ userId, token: "dup", expiresAt })
    ).rejects.toThrow();
  });
});
