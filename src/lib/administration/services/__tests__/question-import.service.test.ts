import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseCsv,
  parseQuestion,
  validateQuestion,
  computeHash,
  normalizeGabarito,
  QuestionImportService,
  QuestionImportError,
} from "../question-import.service";

vi.mock("@/lib/administration/repositories/question.repository", () => ({
  QuestionWriteRepository: {
    findByContentHash: vi.fn().mockResolvedValue(null),
    createQuestion: vi.fn().mockImplementation(async (input) => ({
      id: "q-" + input.enunciado.length,
      ...input,
    })),
    createOptions: vi.fn().mockResolvedValue([]),
  },
}));

import { QuestionWriteRepository } from "@/lib/administration/repositories/question.repository";

describe("parseCsv", () => {
  it("detecta separador ponto-e-vírgula e remove BOM", () => {
    const rows = parseCsv("\uFEFFenunciado;a;b;gabarito\nQual;X;Y;C");
    expect(rows[0]).toEqual(["enunciado", "a", "b", "gabarito"]);
    expect(rows[1]).toEqual(["Qual", "X", "Y", "C"]);
  });

  it("lida com campos entre aspas contendo separador", () => {
    const rows = parseCsv('enunciado;a\n"Texto; com ponto";X');
    expect(rows[1]).toEqual(["Texto; com ponto", "X"]);
  });
});

describe("parseQuestion / validateQuestion", () => {
  it("mapeia aliases e valida questão válida", () => {
    const q = parseQuestion(2, {
      enunciado: "Capital do Brasil?",
      alt_a: "Rio",
      alt_b: "SP",
      alt_c: "Brasília",
      gabarito: "c",
      nivel: "Fácil",
    });
    expect(q.gabarito).toBe("C");
    expect(q.nivel).toBe("facil");
    expect(q.alternativas).toHaveLength(3);
    expect(validateQuestion(q)).toEqual([]);
  });

  it("aponta erros: sem enunciado, poucas alternativas, gabarito inválido", () => {
    const q = parseQuestion(2, { alt_a: "X", gabarito: "F" });
    expect(validateQuestion(q)).toEqual([
      "enunciado obrigatório",
      "é necessário ao menos 2 alternativas",
      "gabarito (A-E) obrigatório",
    ]);
  });

  it("rejeita gabarito que não corresponde a alternativa", () => {
    const q = parseQuestion(2, {
      enunciado: "Pergunta",
      alt_a: "X",
      alt_b: "Y",
      gabarito: "D",
    });
    expect(validateQuestion(q)).toContain("gabarito D não corresponde a uma alternativa");
  });

  it("normaliza gabarito com ruído", () => {
    expect(normalizeGabarito(" letra C ")).toBe("C");
    expect(normalizeGabarito("c.")).toBe("C");
    expect(normalizeGabarito("Z")).toBeUndefined();
  });
});

describe("computeHash", () => {
  it("é estável e normaliza acentos/caixa", () => {
    const a = computeHash({
      row: 1,
      enunciado: "Qual a Capital?",
      alternativas: [
        { letter: "A", text: "Rio" },
        { letter: "B", text: "São Paulo" },
      ],
      gabarito: "B",
    });
    const b = computeHash({
      row: 1,
      enunciado: "qual a capital?",
      alternativas: [
        { letter: "A", text: "Rio" },
        { letter: "B", text: "Sao Paulo" },
      ],
      gabarito: "B",
    });
    expect(a).toBe(b);
  });
});

describe("QuestionImportService.importQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("importa CSV válido com dedup interno", async () => {
    const csv = [
      "enunciado;a;b;c;gabarito",
      "P1;A1;B1;C1;B",
      "P2;A2;B2;C2;A",
      "P1;A1;B1;C1;B", // duplicada dentro do lote
      "P3;A3;", // inválida (2 alternativas? tem 2 mas gabarito C não existe)
    ].join("\n");

    (QuestionWriteRepository.createQuestion as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "q1",
    });

    const result = await QuestionImportService.importQuestions({
      adminUserId: "u1",
      file: new File([csv], "questoes.csv", { type: "text/csv" }),
      subjectId: "aaaaaaaa-0000-4000-8000-000000000001",
      defaultBanca: "Cebraspe",
    });

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(1);
    expect(QuestionWriteRepository.createQuestion).toHaveBeenCalledTimes(2);
    expect(QuestionWriteRepository.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ banca: "Cebraspe", origin: "import", status: "em_revisao" })
    );
  });

  it("lança erro para formato não suportado", async () => {
    await expect(
      QuestionImportService.importQuestions({
        adminUserId: "u1",
        file: new File([Buffer.from("x")], "prova.exe", { type: "application/octet-stream" }),
        subjectId: "aaaaaaaa-0000-4000-8000-000000000001",
      })
    ).rejects.toBeInstanceOf(QuestionImportError);
  });

  it("importa JSON com aliases", async () => {
    const json = JSON.stringify([
      {
        pergunta: "O que é X?",
        alternativa_a: "1",
        alternativa_b: "2",
        alternativa_c: "3",
        resposta: "a",
        dificuldade: "Difícil",
      },
    ]);

    const result = await QuestionImportService.importQuestions({
      adminUserId: "u1",
      file: new File([json], "questoes.json", { type: "application/json" }),
      subjectId: "aaaaaaaa-0000-4000-8000-000000000001",
    });

    expect(result.imported).toBe(1);
    const created = (QuestionWriteRepository.createQuestion as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(created.nivel).toBe("dificil");
    expect(created.gabarito).toBe("A");
  });
});
