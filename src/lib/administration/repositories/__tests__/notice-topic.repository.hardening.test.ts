/**
 * ConcursoAI - FASE 2D: NoticeTopicRepository hardening (caracterizacao + canarios).
 *
 * Estes testes NAO alteram comportamento de producao e NAO conectam banco: Drizzle
 * permanece mockado, como no teste existente da mesma repository. Eles fixam por
 * execucao os quatro riscos apontados pela auditoria da FASE 2C em
 * replaceTopicsForNoticeSubject:
 *
 *   1. descarte silencioso de duplicatas por normalized_name (linha 78);
 *   2. pai inexistente promovido a raiz, perdendo a referencia (linhas 100 a 108);
 *   3. referencia circular quebrada por insercao sem pai (linhas 143 a 169);
 *   4. ambiguidade de pai resolvida apenas pela ordem do array (linhas 101 e 131).
 *
 * Registram tambem o contrato de saida atual (apenas NoticeTopicRow[], sem diagnostico) e o
 * fato de que o replace e um DELETE fisico seguido de INSERT, sem caminho de soft delete.
 *
 * Os canarios usam it.fails: viram falha real quando alguem implementar os diagnosticos,
 * forcindo a revisao desta especificacao. Regra 8 do catalogo (peso ausente nunca e zero)
 * tambem fica protegida aqui.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDelete = vi.fn();
const mockInsert = vi.fn();

const mockTx = {
  delete: mockDelete,
  insert: mockInsert,
};

vi.mock("@/lib/db/drizzle", () => ({
  db: {
    transaction: async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
  },
}));

import { NoticeTopicRepository, type NoticeTopicRow } from "../notice-topic.repository";

type InsertedValues = {
  noticeSubjectId: string;
  knowledgeTopicId: string | null;
  name: string;
  normalizedName: string;
  weight: string | null;
  parentNoticeTopicId: string | null;
  metadata: Record<string, unknown>;
};

type StoredRow = InsertedValues & { id: string };

/** Diagnostico que o contrato FUTURO deveria expor. Hoje nao existe. */
type Diagnostics = {
  discarded?: Array<{ input: string; kept: string }>;
  missingParents?: Array<{ topic: string; parentName: string }>;
  ambiguousParents?: Array<{ topic: string; parentName: string; candidates: string[] }>;
  clampedWeights?: Array<{ topic: string; requested: number; applied: string }>;
};

let stored: StoredRow[];

function armMocks() {
  stored = [];
  mockDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  mockInsert.mockImplementation(() => ({
    values: (val: InsertedValues) => {
      const row: StoredRow = { ...val, id: "id-" + (stored.length + 1) };
      stored.push(row);
      return { returning: async () => [row] };
    },
  }));
}

function withDiagnostics(rows: NoticeTopicRow[]) {
  return rows as unknown as NoticeTopicRow[] & { diagnostics?: Diagnostics };
}

beforeEach(() => {
  vi.clearAllMocks();
  armMocks();
});

describe("FASE 2D / NoticeTopicRepository: descarte de duplicatas", () => {
  it("A1: a duplicata por normalizacao e descartada e o item perdido nao aparece em lugar nenhum", async () => {
    const inputs = [
      { name: "Classes de Palavras", knowledgeTopicId: "k-2026" },
      { name: "Classes de palavras!", knowledgeTopicId: "k-2021" },
    ];

    const res = await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", inputs);

    expect(res).toHaveLength(1);
    expect(res[0].name).toBe("Classes de Palavras");
    // O vinculo pedagogico da segunda grafia nunca chega ao banco.
    expect(stored.some((v) => v.knowledgeTopicId === "k-2021")).toBe(false);
    expect(stored).toHaveLength(1);
  });

  it("A2: o contrato atual nao expoe nenhum canal de diagnostico", async () => {
    const res = withDiagnostics(
      await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", [
        { name: "Coes\u00e3o" },
        { name: "COESAO." },
      ]),
    );

    expect(res).toHaveLength(1);
    expect(Array.isArray(res)).toBe(true);
    expect(res.diagnostics).toBeUndefined();
    // A unica evidencia do descarte e comparar inputs.length com a saida: nada e logado.
    expect(Object.keys(res)).toEqual(["0"]);
  });

  it("A3: nome vazio ou somente espacos tambem e descartado sem sinal", async () => {
    const res = await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", [
      { name: "   " },
      { name: "" },
      { name: "Pontua\u00e7\u00e3o" },
    ]);

    expect(res).toHaveLength(1);
    expect(stored).toHaveLength(1);
    expect(res[0].normalizedName).toBe("pontuacao");
  });

  it.fails("A4 (falha esperada): o descarte deve ser reportado com a entrada perdida", async () => {
    const res = withDiagnostics(
      await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", [
        { name: "Classes de Palavras", knowledgeTopicId: "k-2026" },
        { name: "Classes de palavras!", knowledgeTopicId: "k-2021" },
      ]),
    );

    expect(res.diagnostics?.discarded).toEqual([
      { input: "Classes de palavras!", kept: "Classes de Palavras" },
    ]);
  });
});

describe("FASE 2D / NoticeTopicRepository: pai inexistente e ciclo", () => {
  it("B1: pai que nao esta na lista vira raiz silenciosa e a referencia se perde", async () => {
    const res = await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", [
      { name: "Termos da Ora\u00e7\u00e3o", parentName: "Sintaxe" },
    ]);

    expect(res).toHaveLength(1);
    expect(res[0].parentNoticeTopicId).toBeNull();
    // metadata so guarda o source_text do proprio item: o nome do pai desaparece do registro.
    expect(res[0].metadata).toEqual({ source_text: "Termos da Ora\u00e7\u00e3o" });
  });

  it.fails("B2 (falha esperada): pai ausente deve gerar missingParents", async () => {
    const res = withDiagnostics(
      await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", [
        { name: "Termos da Ora\u00e7\u00e3o", parentName: "Sintaxe" },
      ]),
    );

    expect(res.diagnostics?.missingParents).toEqual([
      { topic: "Termos da Ora\u00e7\u00e3o", parentName: "Sintaxe" },
    ]);
  });

  it("B3: ciclo de dois itens e quebrado por insercao sem pai, sem nenhum aviso", async () => {
    const res = await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", [
      { name: "Coordena\u00e7\u00e3o", parentName: "Subordina\u00e7\u00e3o" },
      { name: "Subordina\u00e7\u00e3o", parentName: "Coordena\u00e7\u00e3o" },
    ]);

    expect(res).toHaveLength(2);
    expect(res.every((r) => r.parentNoticeTopicId === null)).toBe(true);
    // Os dois saem do fallback depois do laco, entao a hierarquia pedida desaparece.
    expect(res.map((r) => r.name)).toEqual(["Coordena\u00e7\u00e3o", "Subordina\u00e7\u00e3o"]);
  });

  it("B4: quando o pai existe, a ordem topologica funciona (baseline que nao pode quebrar)", async () => {
    const res = await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", [
      { name: "Reg\u00eancia Verbal", parentName: "Sintaxe" },
      { name: "Sintaxe" },
    ]);

    expect(res).toHaveLength(2);
    expect(res[0].name).toBe("Sintaxe");
    expect(res[0].parentNoticeTopicId).toBeNull();
    expect(res[1].name).toBe("Reg\u00eancia Verbal");
    expect(res[1].parentNoticeTopicId).toBe("id-1");
  });
});

describe("FASE 2D / NoticeTopicRepository: ambiguidade de pai", () => {
  it("C1: dois candidatos equivalentes sobrevivem so o primeiro, e o filho aponta para ele", async () => {
    const res = await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", [
      { name: "Sem\u00e2ntica", knowledgeTopicId: "k-2026" },
      { name: "SEMANTICA", knowledgeTopicId: "k-2021" },
      { name: "Significa\u00e7\u00e3o das Palavras", parentName: "Sem\u00e2ntica" },
    ]);

    expect(res).toHaveLength(2);
    expect(res[0].knowledgeTopicId).toBe("k-2026");
    expect(res[1].parentNoticeTopicId).toBe(res[0].id);
    expect(stored.some((v) => v.knowledgeTopicId === "k-2021")).toBe(false);
  });

  it("C2: inverter a ordem inverte o vinculo pedagogico escolhido (decisao por posicao)", async () => {
    const res = await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", [
      { name: "SEMANTICA", knowledgeTopicId: "k-2021" },
      { name: "Sem\u00e2ntica", knowledgeTopicId: "k-2026" },
      { name: "Significa\u00e7\u00e3o das Palavras", parentName: "Sem\u00e2ntica" },
    ]);

    expect(res).toHaveLength(2);
    expect(res[0].normalizedName).toBe("semantica");
    // Mesma entrada, mesma hierarquia pedida: muda so a posicao no array e muda o vinculo.
    expect(res[0].knowledgeTopicId).toBe("k-2021");
    expect(res[1].parentNoticeTopicId).toBe(res[0].id);
  });

  it.fails("C3 (falha esperada): ambiguidade deve ser reportada com os candidatos", async () => {
    const res = withDiagnostics(
      await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", [
        { name: "Sem\u00e2ntica", knowledgeTopicId: "k-2026" },
        { name: "SEMANTICA", knowledgeTopicId: "k-2021" },
        { name: "Significa\u00e7\u00e3o das Palavras", parentName: "Sem\u00e2ntica" },
      ]),
    );

    expect(res.diagnostics?.ambiguousParents).toEqual([
      {
        topic: "Significa\u00e7\u00e3o das Palavras",
        parentName: "Sem\u00e2ntica",
        candidates: ["Sem\u00e2ntica", "SEMANTICA"],
      },
    ]);
  });
});

describe("FASE 2D / NoticeTopicRepository: peso e destructive replace", () => {
  it("D1: peso ausente permanece NULL e peso zero continua diferente de ausencia (Regra 8)", async () => {
    const res = await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", [
      { name: "Pontua\u00e7\u00e3o" },
      { name: "Fra\u00e7\u00f5es", weight: 0 },
    ]);

    expect(res[0].weight).toBeNull();
    expect(res[1].weight).toBe("0.00");
    expect(res[0].weight).not.toBe(res[1].weight);
  });

  it("D2: peso fora de zero a cem e silenciado por clamp, sem diagnostico", async () => {
    const res = await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", [
      { name: "An\u00e1lise", weight: 150 },
      { name: "Leitura", weight: -20 },
    ]);

    expect(res[0].weight).toBe("100.00");
    expect(res[1].weight).toBe("0.00");
  });

  it.fails("D3 (falha esperada): clamp de peso deve ser reportado", async () => {
    const res = withDiagnostics(
      await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", [
        { name: "An\u00e1lise", weight: 150 },
      ]),
    );

    expect(res.diagnostics?.clampedWeights).toEqual([
      { topic: "An\u00e1lise", requested: 150, applied: "100.00" },
    ]);
  });

  it("E1: replace faz DELETE fisico antes de qualquer INSERT e nao tem caminho de update", async () => {
    await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", [{ name: "Ortografia" }]);

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockDelete.mock.invocationCallOrder[0]).toBeLessThan(
      mockInsert.mock.invocationCallOrder[0],
    );
    // Se o codigo passar a usar soft delete, mockTx ganha update e este teste obriga revisao.
    expect((mockTx as unknown as { update?: unknown }).update).toBeUndefined();
  });

  it("E2: inputs vazio faz DELETE e devolve array vazio (apagar a lista e um efeitos colateral real)", async () => {
    const res = await NoticeTopicRepository.replaceTopicsForNoticeSubject("ns-1", []);

    expect(res).toEqual([]);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

