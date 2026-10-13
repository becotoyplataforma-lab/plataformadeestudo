/**
 * Import do lote da Aula 14 (extrator de PDF) para o banco.
 *
 * PADRÃO: dry-run. Nada é escrito sem `--aplicar`, e mesmo com `--aplicar` a
 * execução só começa depois de `assertNonProductionDatabaseUrl()` comprovar que
 * `DATABASE_URL` aponta para um banco de teste isolado — desenvolvimento e
 * produção compartilham o mesmo projeto Supabase neste ambiente. Escrita em
 * produção tem outro caminho: a rota de admin `/api/admin/questions/import`,
 * que exige sessão de admin e escolhe o tipo por lote.
 *
 * Os arquivos vêm de `QUESTOES_AULA14_DIR`, o mesmo diretório do carregador da
 * tela (`src/lib/questoes/dados-aula-14.ts`), e são sustentados pelo portão do
 * extrator: `verificar` deve estar verde antes (`docs/30-ATA-...md` §2). Este
 * script não regrava artefato nenhum — só lê os dois JSON de import e declara o
 * `tipo` de cada lote, que é a pendência §7.1: 627 linhas de múltipla escolha e
 * 259 linhas certo/errado, cada uma gravada com o seu tipo.
 *
 * Uso (dry-run, sem banco):
 *   npx tsx --conditions=react-server scripts/importar-aula-14.ts
 * Uso (escreve em banco de teste):
 *   npx tsx --conditions=react-server scripts/importar-aula-14.ts --materia-id <uuid> --aplicar
 *   npx tsx --conditions=react-server scripts/importar-aula-14.ts --materia-nome "Português" --aplicar
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  NonProductionDatabaseRequiredError,
  assertNonProductionDatabaseUrl,
  describeDatabaseSafety,
} from "../src/lib/db/env-guard";
import {
  QuestionImportService,
  type TipoImportacao,
} from "../src/lib/administration/services/question-import.service";
import { KnowledgeSubjectRepository } from "../src/lib/knowledge/repositories/subject.repository";

const ARQUIVO_MULTIPLA = "questoes_aula_14_import.json";
const ARQUIVO_CERTO_ERRADO = "questoes_aula_14_certo_errado_import.json";

/** Um lote por arquivo: o tipo é declarado aqui, nunca inferido do conteúdo. */
const LOTES: { arquivo: string; tipo: TipoImportacao; rotulo: string }[] = [
  { arquivo: ARQUIVO_MULTIPLA, tipo: "multipla_escolha", rotulo: "múltipla escolha" },
  { arquivo: ARQUIVO_CERTO_ERRADO, tipo: "certo_errado", rotulo: "certo/errado" },
];

type Args = {
  dir: string;
  subjectId: string | null;
  subjectName: string | null;
  apply: boolean;
};

function usage(): string {
  return [
    "Uso: tsx --conditions=react-server scripts/importar-aula-14.ts [opções]",
    "  --dir <caminho>        diretório dos artefatos (padrão: QUESTOES_AULA14_DIR)",
    "  --materia-id <uuid>    knowledge_subject_id de destino (exigido com --aplicar)",
    "  --materia-nome <nome>  resolve a matéria pelo nome exato no catálogo",
    "  --aplicar              escreve no banco; sem esta flag o lote só é conferido",
  ].join("\n");
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dir: (process.env.QUESTOES_AULA14_DIR ?? "").trim(),
    subjectId: null,
    subjectName: null,
    apply: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--aplicar") {
      args.apply = true;
      continue;
    }
    if (token === "--dir" || token === "--materia-id" || token === "--materia-nome") {
      const value = argv[++i];
      if (!value) throw new Error(`${token} exige valor.`);
      if (token === "--dir") args.dir = value.trim();
      if (token === "--materia-id") args.subjectId = value.trim();
      if (token === "--materia-nome") args.subjectName = value.trim();
      continue;
    }
    throw new Error(`argumento desconhecido: ${token}`);
  }

  return args;
}

/** Matéria de destino: só é olhada quando há escrita, para o dry-run não depender de banco. */
async function resolverSubjectId(args: Args): Promise<string> {
  if (args.subjectId) return args.subjectId;
  if (!args.subjectName) {
    throw new Error("--aplicar exige --materia-id ou --materia-nome.");
  }
  const found = await KnowledgeSubjectRepository.findByName(args.subjectName);
  if (!found) {
    throw new Error(`matéria "${args.subjectName}" não existe no catálogo.`);
  }
  console.log(`[import-aula-14] matéria "${found.name}" → ${found.id}`);
  return found.id;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.dir === "") {
    console.error(
      "[import-aula-14] sem diretório de artefatos: passe --dir ou defina QUESTOES_AULA14_DIR."
    );
    console.error(usage());
    return 2;
  }

  const presentes = LOTES.filter((lote) => existsSync(join(args.dir, lote.arquivo)));
  if (presentes.length === 0) {
    console.error(`[import-aula-14] nenhum lote encontrado em ${args.dir}.`);
    return 2;
  }

  if (args.apply) {
    // Prova de destino ANTES de qualquer escrita; em produção, o guard bloqueia.
    assertNonProductionDatabaseUrl("import-aula-14", process.env.DATABASE_URL);
  }

  console.log(describeDatabaseSafety("import-aula-14", process.env.DATABASE_URL));
  console.log(`[import-aula-14] modo=${args.apply ? "APLICAR" : "dry-run"} artefatos=${args.dir}`);

  let status = 0;
  const totais = { linhas: 0, importaveis: 0, escritas: 0, ignoradas: 0, erros: 0 };

  for (const lote of presentes) {
    const buffer = await readFile(join(args.dir, lote.arquivo));

    // Conferir antes de escrever: mesmo caminho de parse/valid/hash do
    // importador, sem tocar em banco. Lote fora do tipo não vira linha.
    const conferido = await QuestionImportService.conferirLote({
      buffer,
      fileName: lote.arquivo,
      mimeType: "application/json",
      tipo: lote.tipo,
    });

    totais.linhas += conferido.linhas;
    totais.importaveis += conferido.importaveis;
    totais.erros += conferido.erros.length;

    console.log(
      `[import-aula-14] ${lote.rotulo} (${lote.tipo}) arquivo=${conferido.arquivo} ` +
        `linhas=${conferido.linhas} importaveis=${conferido.importaveis} ` +
        `duplicadasNoLote=${conferido.duplicadasNoLote} erros=${conferido.erros.length} ` +
        `topicos=${conferido.topicos.length}`
    );
    for (const erro of conferido.erros.slice(0, 10)) {
      console.error(`  linha ${erro.row}: ${erro.message}`);
    }

    if (!args.apply) continue;

    if (conferido.erros.length > 0) {
      console.error(
        `[import-aula-14] BLOQUEADO: ${lote.arquivo} tem ${conferido.erros.length} ` +
          `linha(s) fora do tipo ${lote.tipo}. Corrija o extrator ou o lote, ` +
          "e repute o portão (verificar) antes de importar."
      );
      status = status === 0 ? 3 : status;
      continue;
    }

    const subjectId = await resolverSubjectId(args);
    const resultado = await QuestionImportService.importFromBuffer({
      adminUserId: "script:importar-aula-14",
      subjectId,
      tipo: lote.tipo,
      buffer,
      fileName: lote.arquivo,
      mimeType: "application/json",
    });

    totais.escritas += resultado.imported;
    totais.ignoradas += resultado.skipped;
    totais.erros += resultado.errors.length;

    console.log(
      `[import-aula-14] ${lote.tipo}: importadas=${resultado.imported} ` +
        `ignoradas=${resultado.skipped} erros=${resultado.errors.length}`
    );
    for (const erro of resultado.errors.slice(0, 10)) {
      console.error(`  linha ${erro.row}: ${erro.message}`);
    }
    if (resultado.errors.length > 0) status = 1;
  }

  const faltando = LOTES.length - presentes.length;
  if (faltando > 0) {
    console.warn(
      `[import-aula-14] ${faltando} lote(s) ausente(s) no diretório (importação parcial).`
    );
    status = status === 0 ? 4 : status;
  }

  if (args.apply) {
    console.log(
      `[import-aula-14] RESUMO escritas=${totais.escritas} ignoradas=${totais.ignoradas} ` +
        `erros=${totais.erros} — tudo entra em_revisão, não público, needs_review=true.`
    );
  } else {
    console.log(
      `[import-aula-14] RESUMO linhas=${totais.linhas} importaveis=${totais.importaveis} ` +
        `erros=${totais.erros} — NENHUMA LINHA FOI ESCRITA (passe --aplicar com banco de teste).`
    );
  }

  return status;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    if (error instanceof NonProductionDatabaseRequiredError) {
      console.error(`[import-aula-14] BLOCKED ${error.code}: ${error.message}`);
      console.error(
        "  Aponte DATABASE_URL para o banco de teste isolado, ou use a rota de admin."
      );
    } else {
      console.error(
        "[import-aula-14] falha:",
        error instanceof Error ? error.message : error
      );
      console.error(usage());
    }
    process.exitCode = 1;
  }
);