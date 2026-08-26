/**
 * ConcursoAI — Marca e-mails como superadmin (system_settings['superadmin.emails']).
 *
 * Uso: node scripts/seed-superadmins.mjs
 * Lê DATABASE_URL de env ou .env (nunca imprime segredos).
 * Idempotente: adiciona os e-mails à lista existente sem duplicar.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sql from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const TARGETS = ["becotoy@gmail.com", "fanbm@msn.com"];

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

const url = loadDbUrl();
if (!url) {
  console.error("DATABASE_URL não encontrada.");
  process.exit(1);
}

const db = sql(url, { max: 1 });

async function main() {
  const key = "superadmin.emails";
  const [row] = await db`
    SELECT value FROM system_settings WHERE key = ${key} LIMIT 1
  `;

  let current = Array.isArray(row?.value) ? row.value : [];
  const normalized = current.map((e) => String(e).trim().toLowerCase());
  const added = [];
  for (const t of TARGETS) {
    const n = t.trim().toLowerCase();
    if (!normalized.includes(n)) {
      normalized.push(n);
      added.push(n);
    }
  }

  if (added.length === 0) {
    console.log("Nenhum e-mail novo — lista já contém todos os alvos.");
  } else {
    await db`
      INSERT INTO system_settings (key, value, description, created_at, updated_at)
      VALUES (${key}, ${JSON.stringify(normalized)}, 'Allowlist de superadministradores', now(), now())
      ON CONFLICT (key) DO UPDATE
        SET value = ${JSON.stringify(normalized)}, updated_at = now()
    `;
    console.log("Adicionados:", added.join(", "));
  }

  console.log("Lista atual de superadmins:", normalized.join(", "));
  await db.end();
}

main().catch((e) => {
  console.error("Erro:", e.message);
  process.exit(1);
});
