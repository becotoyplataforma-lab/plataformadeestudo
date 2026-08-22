import fs from "node:fs";
import postgres from "postgres";

const env = fs.readFileSync(".env", "utf8");
for (const line of env.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx === -1) continue;
  process.env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
}

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

try {
  // Contagem de dados por tabela
  const counts = {};
  const tables = ["profiles","organs","boards","contests","editais","positions","notice_subjects","documents","document_chunks","embeddings","knowledge_subjects","study_subjects","study_tasks","questions","question_options","question_attempts","flashcards","review_schedules","lessons","lesson_progress","chat_sessions","chat_messages","ai_usage","avatars","plans","subscriptions","payments","event_logs","daily_summaries","system_settings","admin_action_logs"];
  for (const t of tables) {
    try {
      const r = await sql`select count(*)::int as c from public.${sql(t)}`;
      counts[t] = r[0].c;
    } catch (e) {
      counts[t] = "ERRO: " + e.message;
    }
  }
  console.log("Contagens:", JSON.stringify(counts, null, 2));

  // Concursos
  const c = await sql`select id, title, status from public.contests order by created_at`;
  console.log("Concursos:", JSON.stringify(c));

  // Questões por status/origem
  const q = await sql`select status, count(*)::int as c from public.questions group by status order by status`;
  console.log("Questões por status:", JSON.stringify(q));
  const qo = await sql`select origin, count(*)::int as c from public.questions group by origin order by origin`;
  console.log("Questões por origem:", JSON.stringify(qo));

  // Documentos por status
  const d = await sql`select status, count(*)::int as c from public.documents group by status order by status`;
  console.log("Documentos por status:", JSON.stringify(d));

  // notice_subjects
  const ns = await sql`select count(*)::int as c from public.notice_subjects`;
  console.log("notice_subjects:", ns[0].c);

  // system_settings
  const ss = await sql`select key from public.system_settings order by key`;
  console.log("system_settings keys:", ss.map((r) => r.key).join(", "));
} catch (e) {
  console.error("Erro:", e.message);
} finally {
  await sql.end();
}
