import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Dry-run do lote da Aula 14 contra o contrato real do importador.
 *
 * O caminho vem de `QUESTOES_AULA14_DIR`, a mesma variável do carregador
 * (`src/lib/questoes/dados-aula-14.ts`): os artefatos moram na unidade de
 * estudo do usuário e nunca entram no repositório. Sem a variável não há
 * arquivo na máquina, e "dataset ausente" já é o contrato da tela — aqui o
 * suite não roda, em vez de falhar em CI.
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
import { QuestionImportService } from "../question-import.service";

const DIRETORIO = (process.env.QUESTOES_AULA14_DIR ?? "").trim();
const ARQUIVO_MULTIPLA = "questoes_aula_14_import.json";
const ARQUIVO_CERTO_ERRADO = "questoes_aula_14_certo_errado_import.json";
const COLUNAS = [
  "alternativa_a",
  "alternativa_b",
  "alternativa_c",
  "alternativa_d",
  "alternativa_e",
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

async function importar(nome: string) {
  vi.clearAllMocks();
  const linhas = lerLinhas(nome);
  const resultado = await QuestionImportService.importQuestions({
    adminUserId: "dry-run-aula-14",
    file: arquivoFake(nome),
    subjectId: "dry-run-subject",
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
      ARQUIVO_MULTIPLA
    );
    expect(linhas.length).toBeGreaterThan(0);
    expect(resultado.errors).toEqual([]);
    expect(resultado.skipped).toBe(0);
    expect(resultado.imported).toBe(linhas.length);
    expect(questoes).toHaveLength(linhas.length);
    expect(lotesDeOpcoes.flat()).toHaveLength(
      linhas.reduce((n, l) => n + alternativasDaLinha(l), 0)
    );
    console.info(
      `[dry-run] multipla: importadas=${resultado.imported} ignoradas=${resultado.skipped} erros=${resultado.errors.length} alternativas=${lotesDeOpcoes.flat().length}`
    );
  });

  it("nenhuma linha certo/errado é perdida ou rejeitada", async () => {
    const { linhas, resultado, lotesDeOpcoes } = await importar(
      ARQUIVO_CERTO_ERRADO
    );
    expect(linhas.length).toBeGreaterThan(0);
    expect(resultado.errors).toEqual([]);
    expect(resultado.imported).toBe(linhas.length);
    expect(lotesDeOpcoes.flat()).toHaveLength(linhas.length * 2);
    console.info(
      `[dry-run] certo_errado: importadas=${resultado.imported} alternativas=${lotesDeOpcoes.flat().length}`
    );
  });

  it("gabarito aponta sempre para uma alternativa gravada", async () => {
    for (const nome of [ARQUIVO_MULTIPLA, ARQUIVO_CERTO_ERRADO]) {
      const { questoes, lotesDeOpcoes } = await importar(nome);
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
    for (const nome of [ARQUIVO_MULTIPLA, ARQUIVO_CERTO_ERRADO]) {
      const { questoes } = await importar(nome);
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

  it("contentHash é único dentro de cada lote", async () => {
    for (const nome of [ARQUIVO_MULTIPLA, ARQUIVO_CERTO_ERRADO]) {
      const { questoes } = await importar(nome);
      const hashes = questoes.map((q) => q.contentHash as string);
      expect(new Set(hashes).size).toBe(hashes.length);
    }
  });

  it("o serviço grava tipo multipla_escolha até no lote certo/errado", async () => {
    /**
     * Gap registrado, não descoberto depois da escrita: `importQuestions` fixa
     * o tipo (question-import.service.ts:352) enquanto a coluna `questions.tipo`
     * é texto com default "multipla_escolha" (src/db/schema/study.ts:170) e o
     * front já distingue certo_errado (src/lib/questoes/procedencia.ts:108).
     * As 259 linhas C/E entrariam classificadas errado. Este teste trava o
     * comportamento atual para que a decisão do §6 seja tomada com número.
     */
    const { questoes, resultado } = await importar(ARQUIVO_CERTO_ERRADO);
    expect(resultado.errors).toEqual([]);
    expect(new Set(questoes.map((q) => q.tipo))).toEqual(
      new Set(["multipla_escolha"])
    );
  });
});

