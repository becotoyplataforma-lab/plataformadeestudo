/**
 * Pre-hook dos scripts de escrita no banco (db:push, db:seed, migrate).
 *
 * Nenhum comando de escrita e disparado antes de o guard provar que o destino e
 * um banco de teste isolado. Sem prova, o resultado e BLOCKED com codigo 3: o
 * furo nao fica aberto por comodidade, porque desenvolvimento e producao ainda
 * compartilham o mesmo projeto Supabase neste ambiente.
 *
 * Uso: tsx scripts/db-guard.ts -- supabase db push
 */
import { spawnSync } from "node:child_process";

import {
  NonProductionDatabaseRequiredError,
  assertSafeDatabaseCli,
  describeCliDatabaseTarget,
} from "../src/lib/db/cli-db-guard";

function usage(): string {
  return [
    "Uso: tsx scripts/db-guard.ts -- <comando> [argumentos]",
    "  Exemplo: tsx scripts/db-guard.ts -- supabase db push",
  ].join("\n");
}

const argv = process.argv.slice(2);
const separator = argv.indexOf("--");
const command = (separator === -1 ? argv : argv.slice(separator + 1)).filter(
  (token) => token.length !== 0,
);

function run(command: string[]): void {
  const [binary, ...rest] = command;
  const child = spawnSync(binary, rest, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (child.error) {
    console.error("[db-guard] nao foi possivel executar: " + child.error.message);
    process.exitCode = 1;
    return;
  }
  process.exitCode = child.status === null ? 1 : child.status;
}

if (command.length === 0) {
  console.error(usage());
  process.exitCode = 2;
} else {
  console.log(describeCliDatabaseTarget("cli-script"));
  try {
    assertSafeDatabaseCli("cli-script");
  } catch (error) {
    if (error instanceof NonProductionDatabaseRequiredError) {
      console.error("[db-guard] BLOCKED " + error.code + ": " + error.message);
      process.exitCode = 3;
    } else {
      console.error("[db-guard] falha ao avaliar o destino do banco de dados.");
      process.exitCode = 1;
    }
  }
  if ((process.exitCode ?? 0) === 0) {
    run(command);
  }
}
