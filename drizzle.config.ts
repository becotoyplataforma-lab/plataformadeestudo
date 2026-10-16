/**
 * ConcursoAI - Config do drizzle-kit.
 *
 * Guarda fail-closed: os comandos do drizzle-kit que ABREM CONEXAO so podem rodar
 * quando o destino e comprovadamente um banco de teste isolado. generate, check, up,
 * drop e amend continuam liberados porque sao offline e nao tocam o banco.
 *
 * A politica autoritativa vive em src/lib/db/env-guard.ts. npm run db:migrate,
 * db:push e db:seed ja passam por scripts/db-guard.ts; esta checagem cobre quem
 * invocar o drizzle-kit diretamente (npx drizzle-kit push, por exemplo).
 *
 * Excecao unica e estreita: a migracao de producao do release. Ela abre por
 * opt-in amarrado ao ref real do destino, e SO para o comando 'migrate' --
 * push, pull e studio continuam sempre fail-closed. Para abrir o furo, a
 * release afirma as duas condicoes: DB_ALLOW_PRODUCTION_WRITE=true (definida
 * so no job de migracao do docker-compose.migrate.yml) E DB_RELEASE_CONFIRM_REF
 * igual ao project ref REAL do DATABASE_URL (carregado do .env.production). Um
 * ref em desacordo, ausente ou uma flag copiada para outro ambiente nao abre
 * nada: cai no assert fail-closed como qualquer destino de producao.
 */
import { defineConfig } from "drizzle-kit";

import {
  assertNonProductionDatabaseUrl,
  describeDatabaseSafety,
  targetProjectRef,
} from "./src/lib/db/env-guard";

/** Comandos que conectam ao banco. Todo o resto e tratamento offline de arquivos. */
const CONNECTING_COMMANDS = new Set(["push", "migrate", "pull", "studio"]);

/** Project ref oficial do Supabase: 20 caracteres [a-z0-9]. Mesma medida do guard. */
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

/** Unico comando autorizado a receber o furo de escrita em producao. */
const PRODUCTION_WRITE_COMMAND = "migrate";

function envValue(name: string): string {
  const raw = process.env[name];
  if (typeof raw !== "string") return "";
  return raw.trim();
}

/**
 * Opt-in de escrita em producao, valido apenas quando a intencao
 * (DB_ALLOW_PRODUCTION_WRITE=true) e a confirmacao do ref se juntam. O ref
 * confirmado precisa ser IDENTICO ao project ref real do DATABASE_URL, medido
 * por targetProjectRef. Ref ausente, mal formatado ou divergente jamais abre o
 * furo: o chamador cai no assert fail-closed.
 */
function productionMigrationConfirmed(targetRef: string | undefined): boolean {
  if (envValue("DB_ALLOW_PRODUCTION_WRITE") !== "true") return false;

  const confirmed = envValue("DB_RELEASE_CONFIRM_REF").toLowerCase();
  if (!PROJECT_REF_PATTERN.test(confirmed)) {
    console.error(
      "[drizzle-kit] opt-in recusado: DB_RELEASE_CONFIRM_REF ausente ou com formato de project ref invalido.",
    );
    return false;
  }

  if (targetRef === undefined) {
    console.error(
      "[drizzle-kit] opt-in recusado: DATABASE_URL sem project ref identificavel; nada para confirmar.",
    );
    return false;
  }

  if (targetRef !== confirmed) {
    console.error(
      "[drizzle-kit] opt-in recusado: DB_RELEASE_CONFIRM_REF (" +
        confirmed +
        ") nao corresponde ao ref real do destino (" +
        targetRef +
        ").",
    );
    return false;
  }

  return true;
}

function connectingCommand(argv: string[]): string | null {
  for (const arg of argv) {
    if (CONNECTING_COMMANDS.has(arg)) return arg;
  }
  return null;
}

const command = connectingCommand(process.argv.slice(2));

if (command) {
  const target = "drizzle-kit:" + command;
  console.log(describeDatabaseSafety(target));

  const isMigrate = command === PRODUCTION_WRITE_COMMAND;
  if (isMigrate && productionMigrationConfirmed(targetProjectRef())) {
    console.warn(
      "[drizzle-kit] AVISO: escrita em producao autorizada por opt-in apenas para 'migrate'.",
    );
  } else {
    assertNonProductionDatabaseUrl(target);
  }
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
