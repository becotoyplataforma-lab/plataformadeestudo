/**
 * ConcursoAI — Aplica uma migration SQL idempotente ao banco.
 *
 * Uso: node scripts/apply-migration.mjs <arquivo.sql>
 * Lê DATABASE_URL de env ou .env (nunca imprime segredos).
 * Executa cada statement separadamente (compatível com pooler transaction-mode),
 * remove linhas de comentário `--` e continua em caso de erro (registra).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sql from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const target = process.argv[2];

function loadDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = resolve(root, ".env");
  try {
    const raw = readFileSync(envPath, "utf8");
    const line = raw.split("\n").find((l) => l.trim().startsWith("DATABASE_URL="));
    if (line) {
      return line
        .trim()
        .slice("DATABASE_URL=".length)
        .replace(/^["']/, "")
        .replace(/["']$/, "");
    }
  } catch {
    /* ignore */
  }
  return null;
}

if (!target) {
  console.error("Uso: node scripts/apply-migration.mjs <arquivo.sql>");
  process.exit(1);
}

const url = loadDbUrl();
if (!url) {
  console.error("DATABASE_URL não encontrada.");
  process.exit(1);
}

const filePath = resolve(root, target);
const content = readFileSync(filePath, "utf8");

// Remove comentários de linha e separa em statements respeitando aspas simples
const withoutComments = content
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

function splitStatements(text) {
  const out = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" && !inQuote) {
      inQuote = true;
      current += ch;
    } else if (ch === "'" && inQuote) {
      // '' é escape de aspas dentro de string SQL
      if (text[i + 1] === "'") {
        current += "''";
        i++;
      } else {
        inQuote = false;
        current += ch;
      }
    } else if (ch === ";" && !inQuote) {
      out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out.filter(Boolean);
}

const statements = splitStatements(withoutComments);

console.log(`Aplicando ${statements.length} statements de ${target}...`);

const s = sql(url, { max: 1 });
let ok = 0;
let err = 0;

for (const stmt of statements) {
  try {
    await s.unsafe(stmt);
    ok++;
    console.log(`  ✓ ${stmt.slice(0, 70)}${stmt.length > 70 ? "…" : ""}`);
  } catch (e) {
    err++;
    console.log(`  ✗ ${stmt.slice(0, 70)}${stmt.length > 70 ? "…" : ""} :: ${e.message}`);
  }
}

await s.end();
console.log(`\nRESULTADO: ${ok} ok, ${err} erro(s).`);
process.exit(err > 0 ? 2 : 0);
