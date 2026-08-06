import fs from "node:fs";
import postgres from "postgres";

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

const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
});

try {
  const result = await sql`select version()`;
  console.log("✅ Conectado com sucesso!");
  console.log(result);
} catch (err) {
  console.error("❌ Erro:");
  console.error(err);
} finally {
  await sql.end();
}