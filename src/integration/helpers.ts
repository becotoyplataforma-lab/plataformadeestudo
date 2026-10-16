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
import { questions } from "@/db/schema/study";
import { knowledgeSubjects } from "@/db/schema/knowledge";
import { assertNonProductionDatabaseUrl, resolveDatabaseTestGate } from "@/lib/db/env-guard";

/** true se há um banco real configurado (DATABASE_URL). */
/**
 * Gate da suíte: decide antes de qualquer conexao e guarda a justificativa log-safe.
 * Use `describe.skipIf(!hasDb)` e registre `dbGateReason` quando precisar explicar
 * o skip. O gate e fail-closed: URL ausente, invalida ou de producao deixa tudo off.
 */
export const dbGate = resolveDatabaseTestGate("integration", process.env.DATABASE_URL);

/** true apenas quando existe banco de teste comprovadamente isolado. */
export const hasDb = dbGate.enabled;

/** Justificativa do veredito, ja em formato seguro para log. */
export const dbGateReason = dbGate.reason;

/** Resumo log-safe: alvo, host, database, ref, prodRef, safe e motivo. */
export const dbGateSummary = dbGate.summary;

/** Cria um usuário de teste em auth.users (as FKs cascateiam a limpeza). */
export async function createTestUser(): Promise<string> {
  assertNonProductionDatabaseUrl("integration-test");
  const id = randomUUID();
  await db.insert(authUsers).values({ id });
  return id;
}

/** Remove o usuário de teste (cascade nas tabelas filhas). */
export async function deleteTestUser(id: string): Promise<void> {
  assertNonProductionDatabaseUrl("integration-test");
  await db.delete(authUsers).where(eq(authUsers.id, id));
}

/**
 * Matéria de teste: `knowledge_subjects` não tem `user_id`, então
 * `deleteTestUser` não a alcança. Sem este par, todo teste que cria assunto
 * deixa catálogo órfão no banco — foi exatamente assim que "E2E a1b2c3d4" e a
 * questão "Qual é a pergunta?" apareceram para o aluno na tela de questões.
 */
export async function createTestSubject(name: string, slug: string): Promise<string> {
  assertNonProductionDatabaseUrl("integration-test");
  const [row] = await db
    .insert(knowledgeSubjects)
    .values({ name, slug })
    .returning({ id: knowledgeSubjects.id });
  if (!row) throw new Error(`Falha ao criar matéria de teste (${slug}).`);
  return row.id;
}

/** Apaga as questões da matéria (cascade em options/attempts) e depois a matéria. */
export async function deleteTestSubject(subjectId: string): Promise<void> {
  assertNonProductionDatabaseUrl("integration-test");
  await db.delete(questions).where(eq(questions.knowledgeSubjectId, subjectId));
  await db.delete(knowledgeSubjects).where(eq(knowledgeSubjects.id, subjectId));
}

/** Início do dia local (para ai_usage). */
export function startOfDay(d = new Date()): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return day;
}
