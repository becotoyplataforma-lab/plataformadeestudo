import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Dry-run do lote da Aula 14 contra o contrato real do importador.
 *
 * O caminho vem de `direcaoDataset()` (`src/lib/questoes/diretorio-dataset.ts`),
 * a mesma precedência do carregador da tela: os artefatos moram na unidade de
 * estudo do usuário e nunca entram no repositório. Sem a variável não há
 * arquivo na máquina, e "dataset ausente" já é o contrato da tela — aqui o
 * suite não roda, em vez de falhar em CI.
 *
 * É essa função compartilhada que fecha a armadilha que existia aqui: o guarda
 * lia só o nome legado (`QUESTOES_AULA14_DIR`), então num ambiente configurado
 * com o nome genérico os 8 casos abaixo viravam `skip` silencioso — cobertura
 * que se desliga sozinha sem ninguém ver.
 *
 * O repositório de escrita é mocked: nada toca banco. O que se exercita é a
 * parte do `importQuestions` que decide se uma linha vira linha de banco —
 * leitura do arquivo, `resolveColumn`, `parseQuestion`, `validateQuestion`,
 * dedupe por `contentHash` e o payload entregue a `createQuestion`/
 * `createOptions`.
 */

vi.mock("@/lib/administration/repositories/question.repository", () => ({
  QuestionWriteRepository: {
    findByContentHash: vi.fn().mockResolvedValue(null),
    createQuestion: vi.fn().mockImplementation(async (input: { enunciado: string }) => ({
      id: "q-" + input.enunciado.length,
      ...input,
    })),
    createOptions: vi.fn().mockResolvedValue([]),
  },
}));

import { QuestionWriteRepository } from "@/lib/administration/repositories/question.repository";
import { direcaoDataset } from "@/lib/questoes/diretorio-dataset";
import {
  QuestionImportService,
  type TipoImportacao,
} from "../question-import.service";

const DIRETORIO = direcaoDataset()?.caminho ?? "";
const ARQUIVO_MULTIPLA = "questoes_aula_14_import.json";
const ARQUIVO_CERTO_ERRADO = "questoes_aula_14_certo_errado_import.json";
const COLUNAS = [
  "alternativa_a",
  "alternativa_b",
  "alternativa_c",
  "alternativa_d",
  "alternativa_e",
];

/** Cada lote tem um tipo declarado — é o que o importador agora exige (§7.1). */
const LOTES: { arquivo: string; tipo: TipoImportacao; rotulo: string }[] = [
  { arquivo: ARQUIVO_MULTIPLA, tipo: "multipla_escolha", rotulo: "multipla" },
  { arquivo: ARQUIVO_CERTO_ERRADO, tipo: "certo_errado", rotulo: "certo_errado" },
];

type Linha = Record<string, string>;

function lerLinhas(nome: string): Linha[] {
  return JSON.parse(readFileSync(join(DIRETORIO, nome), "utf8")) as Linha[];
}

function alternativasDaLinha(linha: Linha): number {
  return COLUNAS.filter((c) => (linha[c] ?? "").trim().length > 0).length;
}

/**
 * `importQuestions` só usa `name`, `type` e `arrayBuffer()`. Um objeto próprio
 * dispensa o global `File` e mantém o dry-run rodando em Node sem DOM.
 */
function arquivoFake(nome: string): File {
  const buffer = readFileSync(join(DIRETORIO, nome));
  return {
    name: nome,
    type: "application/json",
    size: buffer.byteLength,
    arrayBuffer: async () =>
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer,
  } as unknown as File;
}

async function importar(nome: string, tipo: TipoImportacao) {
  vi.clearAllMocks();
  const linhas = lerLinhas(nome);
  const resultado = await QuestionImportService.importQuestions({
    adminUserId: "dry-run-aula-14",
    file: arquivoFake(nome),
    subjectId: "dry-run-subject",
    tipo,
  });
  const questoes = vi
    .mocked(QuestionWriteRepository.createQuestion)
    .mock.calls.map((c) => c[0]);
  const lotesDeOpcoes = vi
    .mocked(QuestionWriteRepository.createOptions)
    .mock.calls.map((c) => c[0]);
  return { linhas, resultado, questoes, lotesDeOpcoes };
}

const semDataset =
  DIRETORIO === "" || !existsSync(join(DIRETORIO, ARQUIVO_MULTIPLA));
const descrever = semDataset ? describe.skip : describe;

descrever("dry-run do import da Aula 14 (artefatos locais, banco mockado)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("nenhuma linha de múltipla escolha é perdida ou rejeitada", async () => {
    const { linhas, resultado, questoes, lotesDeOpcoes } = await importar(
      ARQUIVO_MULTIPLA,
      "multipla_escolha"
    );
    expect(linhas.length).toBeGreaterThan(0);
    expect(resultado.errors).toEqual([]);
    expect(resultado.skipped).toBe(0);
    expect(resultado.imported).toBe(linhas.length);
    expect(questoes).toHaveLength(linhas.length);
    expect(lotesDeOpcoes.flat()).toHaveLength(
      linhas.reduce((n, l) => n + alternativasDaLinha(l), 0)
    );
    // O tipo que se declara é o tipo que se grava — nenhuma linha C/E se
    // esconde aqui, porque o guard recusa o par C/E em lote de múltipla.
    expect(new Set(questoes.map((q) => q.tipo))).toEqual(
      new Set(["multipla_escolha"])
    );
    console.info(
      `[dry-run] multipla: importadas=${resultado.imported} ignoradas=${resultado.skipped} erros=${resultado.errors.length} alternativas=${lotesDeOpcoes.flat().length}`
    );
  });

  it("nenhuma linha certo/errado é perdida ou rejeitada", async () => {
    const { linhas, resultado, questoes, lotesDeOpcoes } = await importar(
      ARQUIVO_CERTO_ERRADO,
      "certo_errado"
    );
    expect(linhas.length).toBeGreaterThan(0);
    expect(resultado.errors).toEqual([]);
    expect(resultado.imported).toBe(linhas.length);
    expect(lotesDeOpcoes.flat()).toHaveLength(linhas.length * 2);
    expect(new Set(questoes.map((q) => q.tipo))).toEqual(
      new Set(["certo_errado"])
    );
    expect(
      lotesDeOpcoes.every((lote) => lote.map((o) => o.letter).join("") === "CE")
    ).toBe(true);
    console.info(
      `[dry-run] certo_errado: importadas=${resultado.imported} tipo=certo_errado alternativas=${lotesDeOpcoes.flat().length}`
    );
  });

  it("gabarito aponta sempre para uma alternativa gravada", async () => {
    for (const lote of LOTES) {
      const { questoes, lotesDeOpcoes } = await importar(lote.arquivo, lote.tipo);
      const semGabarito = questoes.filter((q, i) => {
        const letras = lotesDeOpcoes[i].map((o) => o.letter);
        return !letras.includes(String(q.gabarito));
      });
      expect(semGabarito).toEqual([]);
      const corretas = lotesDeOpcoes.map((lote) =>
        lote.filter((o) => o.isCorrect).length
      );
      expect(corretas.every((n) => n === 1)).toBe(true);
    }
  });

  it("tudo entra em revisão, não público e sem explicação de terceiro", async () => {
    for (const lote of LOTES) {
      const { questoes } = await importar(lote.arquivo, lote.tipo);
      expect(questoes.every((q) => q.status === "em_revisao")).toBe(true);
      expect(questoes.every((q) => q.isPublic === false)).toBe(true);
      expect(questoes.every((q) => q.needsReview === true)).toBe(true);
      expect(questoes.every((q) => q.origin === "import")).toBe(true);
      expect(questoes.every((q) => q.aiGenerated === false)).toBe(true);
      expect(questoes.every((q) => q.explicacao === undefined)).toBe(true);
      expect(
        questoes.every(
          (q) => typeof q.contentHash === "string" && q.contentHash.length === 64
        )
      ).toBe(true);
    }
  });

  it("contentHash é único dentro de cada lote e entre os dois lotes", async () => {
    const todos: string[] = [];
    for (const lote of LOTES) {
      const { questoes } = await importar(lote.arquivo, lote.tipo);
      const hashes = questoes.map((q) => q.contentHash as string);
      expect(new Set(hashes).size).toBe(hashes.length);
      todos.push(...hashes);
    }
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("o tipo declarado decide o tipo gravado (§7.1 resolvido)", async () => {
    /**
     * O gap que o dry-run expôs: `importQuestions` fixava "multipla_escolha",
     * então as linhas C/E entrariam classificadas errado. O serviço agora recebe
     * o tipo do lote, e cada lote é gravado com o tipo que se declarou.
     */
    const multipla = await importar(ARQUIVO_MULTIPLA, "multipla_escolha");
    const certoErrado = await importar(ARQUIVO_CERTO_ERRADO, "certo_errado");

    expect(multipla.resultado.errors).toEqual([]);
    expect(certoErrado.resultado.errors).toEqual([]);
    expect(new Set(multipla.questoes.map((q) => q.tipo))).toEqual(
      new Set(["multipla_escolha"])
    );
    expect(new Set(certoErrado.questoes.map((q) => q.tipo))).toEqual(
      new Set(["certo_errado"])
    );
    console.info(
      `[dry-run] tipos: multipla_escolha=${multipla.resultado.imported} ` +
        `certo_errado=${certoErrado.resultado.imported}`
    );
  });

  it("tipo trocado entre os lotes não grava nenhuma linha", async () => {
    /**
     * Guarda de coerência: lote C/E declarado múltipla escolha e lote múltiplo
     * declarado C/E são rejeitados linha a linha antes de qualquer escrita.
     */
    const ceComoMultipla = await importar(ARQUIVO_CERTO_ERRADO, "multipla_escolha");
    expect(ceComoMultipla.questoes).toEqual([]);
    expect(ceComoMultipla.resultado.imported).toBe(0);
    expect(ceComoMultipla.resultado.errors).toHaveLength(
      ceComoMultipla.linhas.length
    );
    expect(ceComoMultipla.resultado.errors[0].message).toContain(
      "exige o tipo certo_errado"
    );

    const multiplaComoCe = await importar(ARQUIVO_MULTIPLA, "certo_errado");
    expect(multiplaComoCe.questoes).toEqual([]);
    expect(multiplaComoCe.resultado.errors[0].message).toContain(
      "tipo certo_errado exige exatamente as alternativas C e E"
    );
  });

  it("conferirLote conta o lote inteiro sem tocar em banco", async () => {
    vi.clearAllMocks();
    let linhas = 0;
    let importaveis = 0;

    for (const lote of LOTES) {
      const conferido = await QuestionImportService.conferirLote({
        buffer: readFileSync(join(DIRETORIO, lote.arquivo)),
        fileName: lote.arquivo,
        mimeType: "application/json",
        tipo: lote.tipo,
      });
      expect(conferido.tipo).toBe(lote.tipo);
      expect(conferido.erros).toEqual([]);
      expect(conferido.duplicadasNoLote).toBe(0);
      expect(conferido.importaveis).toBe(conferido.linhas);
      linhas += conferido.linhas;
      importaveis += conferido.importaveis;
    }

    expect(QuestionWriteRepository.createQuestion).not.toHaveBeenCalled();
    expect(QuestionWriteRepository.findByContentHash).not.toHaveBeenCalled();
    console.info(
      `[dry-run] conferirLote: linhas=${linhas} importaveis=${importaveis} (escritas=0)`
    );
  });
});

