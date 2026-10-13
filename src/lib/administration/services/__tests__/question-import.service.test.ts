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

  it("importa XLSX válido (SheetJS 0.20.x)", async () => {
    // Gera um XLSX real usando a própria lib (valida a compatibilidade da
    // versão 0.20.3 instalada via CDN SheetJS com o código existente).
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["enunciado", "a", "b", "c", "gabarito"],
      ["Capital do Brasil?", "Rio", "SP", "Brasília", "C"],
      ["Maior planeta?", "Terra", "Júpiter", "Marte", "B"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questões");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const result = await QuestionImportService.importQuestions({
      adminUserId: "u1",
      file: new File([buffer], "questoes.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      subjectId: "aaaaaaaa-0000-4000-8000-000000000001",
    });

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(QuestionWriteRepository.createQuestion).toHaveBeenCalledTimes(2);
    const first = (QuestionWriteRepository.createQuestion as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(first.gabarito).toBe("C");
    expect(first.enunciado).toBe("Capital do Brasil?");
    // As alternativas são gravadas via createOptions (não no createQuestion).
    expect(QuestionWriteRepository.createOptions).toHaveBeenCalledTimes(2);
    const opts = (QuestionWriteRepository.createOptions as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(opts).toHaveLength(3);
    expect(opts.find((o: { letter: string }) => o.letter === "C").isCorrect).toBe(true);
  });
});

describe("tipo do lote (multipla_escolha × certo_errado)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const SUBJECT = "aaaaaaaa-0000-4000-8000-000000000001";
  const ultimaQuestaoCriada = () =>
    (QuestionWriteRepository.createQuestion as ReturnType<typeof vi.fn>).mock
      .calls.at(-1)?.[0] as Record<string, unknown>;
  const ultimoLoteDeOpcoes = () =>
    (QuestionWriteRepository.createOptions as ReturnType<typeof vi.fn>).mock
      .calls.at(-1)?.[0] as { letter: string; text: string; isCorrect: boolean }[];

  const loteCe = JSON.stringify([
    {
      enunciado: "O uso da crase está correto na expressão 'àquela hora'?",
      alternativa_c: "Certo",
      alternativa_e: "Errado",
      gabarito: "c",
      topic: "Crase",
    },
  ]);

  it("grava o lote C/E com tipo certo_errado e o par C/E nas alternativas", async () => {
    const result = await QuestionImportService.importQuestions({
      adminUserId: "u1",
      file: new File([loteCe], "ce.json", { type: "application/json" }),
      subjectId: SUBJECT,
      tipo: "certo_errado",
    });

    expect(result.errors).toEqual([]);
    expect(result.imported).toBe(1);
    expect(ultimaQuestaoCriada().tipo).toBe("certo_errado");
    expect(ultimaQuestaoCriada().gabarito).toBe("C");
    expect(ultimoLoteDeOpcoes().map((o) => [o.letter, o.text])).toEqual([
      ["C", "Certo"],
      ["E", "Errado"],
    ]);
    expect(ultimoLoteDeOpcoes().find((o) => o.letter === "C")?.isCorrect).toBe(true);
  });

  it("mantém multipla_escolha como default (compatibilidade com lotes antigos)", async () => {
    const result = await QuestionImportService.importQuestions({
      adminUserId: "u1",
      file: new File([loteCe], "ce.json", { type: "application/json" }),
      subjectId: SUBJECT,
    });

    // Sem declarar o tipo, a linha C/E NÃO é gravada: o guard recusa o par.
    expect(result.imported).toBe(0);
    expect(result.errors[0]?.message).toContain(
      "linha certo/errado (C=Certo, E=Errado) exige o tipo certo_errado"
    );
  });

  it("recusa lote declarado certo_errado que traz alternativas de múltipla escolha", async () => {
    const json = JSON.stringify([
      {
        enunciado: "Capital do Brasil?",
        alternativa_a: "Rio",
        alternativa_b: "SP",
        gabarito: "b",
      },
    ]);

    const result = await QuestionImportService.importQuestions({
      adminUserId: "u1",
      file: new File([json], "mix.json", { type: "application/json" }),
      subjectId: SUBJECT,
      tipo: "certo_errado",
    });

    expect(result.imported).toBe(0);
    expect(result.errors[0]?.message).toContain(
      "tipo certo_errado exige exatamente as alternativas C e E (linha traz: AB)"
    );
    expect(QuestionWriteRepository.createQuestion).not.toHaveBeenCalled();
  });

  it("recusa par C/E com texto que não é Certo/Errado, e tolera pontuação e caixa", async () => {
    const errado = JSON.stringify([
      { enunciado: "P?", alternativa_c: "Sim", alternativa_e: "Não", gabarito: "c" },
    ]);
    const comRuido = JSON.stringify([
      { enunciado: "P?", alternativa_c: " CERTO. ", alternativa_e: "Errado", gabarito: "e" },
    ]);

    const rejeitado = await QuestionImportService.importQuestions({
      adminUserId: "u1",
      file: new File([errado], "errado.json", { type: "application/json" }),
      subjectId: SUBJECT,
      tipo: "certo_errado",
    });
    expect(rejeitado.errors[0]?.message).toContain(
      'tipo certo_errado exige os textos "Certo" e "Errado"'
    );

    const aceito = await QuestionImportService.importQuestions({
      adminUserId: "u1",
      file: new File([comRuido], "ruido.json", { type: "application/json" }),
      subjectId: SUBJECT,
      tipo: "certo_errado",
    });
    expect(aceito.errors).toEqual([]);
    expect(aceito.imported).toBe(1);
    expect(ultimoLoteDeOpcoes().map((o) => o.text)).toEqual(["CERTO.", "Errado"]);
  });

  it("conferirLote conta sem escrever", async () => {
    vi.mocked(QuestionWriteRepository.createQuestion).mockClear();
    const conferido = await QuestionImportService.conferirLote({
      buffer: Buffer.from(loteCe),
      fileName: "ce.json",
      mimeType: "application/json",
      tipo: "certo_errado",
    });

    expect(conferido).toMatchObject({
      arquivo: "ce.json",
      tipo: "certo_errado",
      linhas: 1,
      importaveis: 1,
      duplicadasNoLote: 0,
      topicos: ["Crase"],
    });
    expect(conferido.erros).toEqual([]);
    expect(QuestionWriteRepository.createQuestion).not.toHaveBeenCalled();
  });

  it("importFromBuffer aceita bytes lidos de disco e grava o tipo declarado", async () => {
    const result = await QuestionImportService.importFromBuffer({
      adminUserId: "script:aula-14",
      subjectId: SUBJECT,
      tipo: "certo_errado",
      buffer: Buffer.from(loteCe),
      fileName: "ce.json",
      mimeType: "application/json",
    });

    expect(result.imported).toBe(1);
    expect(ultimaQuestaoCriada()).toMatchObject({
      tipo: "certo_errado",
      status: "em_revisao",
      isPublic: false,
      needsReview: true,
      topic: "Crase",
    });
  });
});
