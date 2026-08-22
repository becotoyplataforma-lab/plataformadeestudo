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
  const m = await sql`select * from drizzle.__drizzle_migrations order by created_at`;
  console.log("Drizzle migrations aplicadas:", JSON.stringify(m));

  const t = await sql`select tablename from pg_tables where schemaname='public' order by tablename`;
  console.log("Tabelas public:", t.length);

  // Verifica colunas de migrations manuais (pricing-limits, fsrs, admin-content, consolidation)
  const plans = await sql`select code, price_cents, promo_price_cents from public.plans order by code`;
  console.log("Plans:", JSON.stringify(plans));

  const rs = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='review_schedules' order by ordinal_position`;
  console.log("review_schedules colunas:", rs.map((r) => r.column_name).join(", "));

  const docs = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='documents' order by ordinal_position`;
  console.log("documents colunas:", docs.map((r) => r.column_name).join(", "));

  const src = await sql`select distinct source_type from public.documents`;
  console.log("documents.source_type valores:", src.map((r) => r.source_type).join(", "));

  const ext = await sql`select extname from pg_extension order by extname`;
  console.log("Extensões:", ext.map((r) => r.extname).join(", "));
} catch (e) {
  console.error("Erro:", e.message);
} finally {
  await sql.end();
}
