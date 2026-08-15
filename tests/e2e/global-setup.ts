/**
 * Global Setup do Playwright — ISOLAMENTO do usuário E2E.
 *
 * Antes de cada execução, remove os dados de teste acumulados do usuário E2E
 * (study_tasks, study_subjects, flashcards, question_attempts, ai_usage,
 * chat_sessions/messages), garantindo:
 *   - replan estável (não cresce indefinidamente);
 *   - execução determinística (não depende de execuções anteriores);
 *   - mesmo comportamento após falhas (a próxima execução sempre começa limpa).
 *
 * SEGURANÇA:
 *   - Só executa com E2E_USER_EMAIL + DATABASE_URL.
 *   - TODOS os DELETEs são escopados por user_id do usuário E2E (resolvido
 *     pelo e-mail). NUNCA toca dados de outros usuários.
 *   - É infraestrutura de TESTE (globalSetup do Playwright) — NÃO é um
 *     endpoint exposto em produção.
 *   - Se algo falhar, apenas registra aviso e segue (não bloqueia os testes).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import postgres from "postgres";

/**
 * Resolve a DATABASE_URL: da env ou do .env local (para os E2E não precisarem
 * exportar DATABASE_URL no shell — evita ativar os testes de integração do
 * vitest no mesmo processo).
 */
function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const content = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    const m = content.match(/^DATABASE_URL=(.*)$/m);
    if (m) return m[1].trim().replace(/^"|"$/g, "");
  } catch {
    // sem .env — cleanup pula
  }
  return undefined;
}

export default async function globalSetup() {
  const email = process.env.E2E_USER_EMAIL;
  const dbUrl = resolveDatabaseUrl();
  if (!email || !dbUrl) {
    console.log("[E2E-SETUP] Sem E2E_USER_EMAIL/DATABASE_URL — cleanup pulado.");
    return;
  }

  const sql = postgres(dbUrl, { ssl: "require" });
  try {
    const [user] = await sql<{ id: string }[]>`
      SELECT id FROM auth.users WHERE email = ${email} LIMIT 1
    `;
    if (!user) {
      console.log(`[E2E-SETUP] Usuário E2E "${email}" não encontrado — nada a limpar.`);
      return;
    }
    const userId = user.id;

    // Ordem respeita FKs; tudo escopado ao usuário E2E.
    await sql`DELETE FROM study_tasks WHERE user_id = ${userId}`;
    await sql`DELETE FROM study_subjects WHERE user_id = ${userId}`;
    await sql`
      DELETE FROM review_schedules
      WHERE flashcard_id IN (SELECT id FROM flashcards WHERE user_id = ${userId})
    `;
    await sql`DELETE FROM flashcards WHERE user_id = ${userId}`;
    await sql`DELETE FROM question_attempts WHERE user_id = ${userId}`;
    await sql`DELETE FROM ai_usage WHERE user_id = ${userId}`;
    await sql`DELETE FROM chat_messages WHERE user_id = ${userId}`;
    await sql`DELETE FROM chat_sessions WHERE user_id = ${userId}`;

    console.log(`[E2E-SETUP] Cleanup concluído para o usuário E2E (${email}).`);
  } catch (err) {
    // Nunca bloqueia a execução — registra e segue.
    console.warn(`[E2E-SETUP] Cleanup ignorado (${(err as Error).message}).`);
  } finally {
    await sql.end().catch(() => {});
  }
}
