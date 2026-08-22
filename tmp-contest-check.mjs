import fs from "node:fs";
import postgres from "postgres";

const env = fs.readFileSync(".env", "utf8");
for (const line of env.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx === -1) continue;
  process.env[line.slice(0, idx).trim()] = line
    .slice(idx + 1)
    .trim()
    .replace(/^"|"$/g, "");
}

const sql = postgres(process.env.DIRECT_URL, { ssl: "require" });

try {
  const tables = ["organs", "boards", "contests", "editais", "positions", "notice_subjects"];
  console.log("== TABELAS CONTEST ==");
  for (const t of tables) {
    const r = await sql`select to_regclass('public.' || ${t}) as rel`;
    console.log(`  public.${t}: ${r[0].rel ?? "NAO EXISTE"}`);
  }

  console.log("== PROFILES COLUNAS ==");
  const prof = await sql`
    select column_name, data_type from information_schema.columns
    where table_schema='public' and table_name='profiles'
    order by ordinal_position`;
  for (const c of prof) console.log(`  ${c.column_name} (${c.data_type})`);

  console.log("== ENUMS ==");
  const enums = await sql`
    select t.typname, e.enumlabel
    from pg_type t join pg_enum e on e.enumtypid = t.oid
    where t.typname in ('contest_status','edital_status','lifecycle_status')
    order by t.typname, e.enumsortorder`;
  if (!enums.length) console.log("  (nenhum dos enums esperados existe)");
  for (const e of enums) console.log(`  ${e.typname}: ${e.enumlabel}`);

  console.log("== MIGRATIONS ==");
  const mig = await sql`select to_regclass('drizzle.__drizzle_migrations') as rel`;
  console.log(`  drizzle.__drizzle_migrations: ${mig[0].rel ?? "NAO EXISTE"}`);

  console.log("== RLS (public) ==");
  const rls = await sql`
    select c.relname,
           (case when c.relrowsecurity then 'ON' else 'OFF' end) as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relkind='r'
    order by c.relname`;
  const on = rls.filter((r) => r.rls === "ON").length;
  const off = rls.filter((r) => r.rls === "OFF").length;
  console.log(`  tabelas public: ${rls.length} | RLS ON: ${on} | RLS OFF: ${off}`);

  console.log("== knowledge_subjects ==");
  const ks = await sql`select to_regclass('public.knowledge_subjects') as rel`;
  console.log(`  ${ks[0].rel ?? "NAO EXISTE"}`);

  console.log("== CONSTRAINTS profiles (contest) ==");
  const cons = await sql`
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname like 'fk_profiles_contest%'`;
  console.log(`  ${cons.map((c) => c.conname).join(", ") || "nenhuma"}`);
} catch (e) {
  console.error("ERRO:", e.message);
} finally {
  await sql.end();
}
