import fs from "node:fs";
import postgres from "postgres";
import {
  SCRIPT_DB_BLOCKED_EXIT_CODE,
  guardScriptDatabaseTargetOrExit,
  mergeDatabaseEnv,
} from "./scripts/lib/db-safety.mjs";

// Carrega o .env
const env = fs.readFileSync(".env", "utf8");

for (const line of env.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;

  const idx = line.indexOf("=");
  if (idx === -1) continue;

  const key = line.slice(0, idx).trim();
  const value = line.slice(idx + 1).trim().replace(/^"|"$/g, "");

  process.env[key] = value;
}

// Guarda fail-closed: nenhuma conexao e aberta antes de provar que o destino e
// banco de teste isolado. O ambiente considera os arquivos .env porque o projeto
// ainda tem producao e desenvolvimento no mesmo Supabase.
const decisionEnv = mergeDatabaseEnv(fs, process.env, process.cwd(), [".env"]);
const target = process.env.DATABASE_URL;
const verdict = guardScriptDatabaseTargetOrExit("test-db", target, decisionEnv);
if (!verdict.safe) {
  process.exit(SCRIPT_DB_BLOCKED_EXIT_CODE);
}

const sql = postgres(target, {
  ssl: "require",
});

try {
  const result = await sql`select version()`;
  console.log("Conectado com sucesso!");
  // Nao imprime nada alem do veredito: erro cru de driver costuma
  // carregar usuario, host e porta da conexao.
  void result;
} catch (err) {
  console.error("Falha ao conectar; codigo: " + (err && err.code ? String(err.code) : "desconhecido") + ". A conexao nao sera impressa.");
  process.exitCode = 1;
} finally {
  await sql.end();
}
