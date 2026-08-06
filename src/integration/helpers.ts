/**
 * FASE 18 — Helpers de testes de integração real (PostgreSQL real).
 *
 * Testes reais (sem mocks de repositórios/Services) que rodam contra um
 * PostgreSQL real via DATABASE_URL. Sem DATABASE_URL, os testes são pulados
 * (describe.skipIf), mantendo `npm test` verde em ambientes sem banco.
 */
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/drizzle";
import { authUsers } from "@/db/schema/identity";

/** true se há um banco real configurado (DATABASE_URL). */
export const hasDb = Boolean(process.env.DATABASE_URL);

/** Cria um usuário de teste em auth.users (as FKs cascateiam a limpeza). */
export async function createTestUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(authUsers).values({ id });
  return id;
}

/** Remove o usuário de teste (cascade nas tabelas filhas). */
export async function deleteTestUser(id: string): Promise<void> {
  await db.delete(authUsers).where(eq(authUsers.id, id));
}

/** Início do dia local (para ai_usage). */
export function startOfDay(d = new Date()): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return day;
}
