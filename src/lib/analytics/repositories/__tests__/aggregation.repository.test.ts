/**
 * Testes do AggregationRepository.getEditalContext — resolução do contexto
 * de edital (Grupo D) que alimenta o AdaptivePlannerService.
 *
 * Regras DD-020/DD-021 verificadas:
 *  - Sem contest_id no perfil → null (neutro).
 *  - Sem edital publicado + is_current do concurso → null (neutro).
 *  - position_id preenchido → pesos do cargo; sem pesos do cargo → fallback geral.
 *  - position_id NULL → pesos gerais (position_id NULL).
 *  - Sem notice_subjects no escopo → null (neutro).
 *  - Retorna contestId, positionId e rows [{knowledgeSubjectId, weight}].
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();

vi.mock("@/lib/db/drizzle", () => ({
  db: { select: (...a: unknown[]) => mockSelect(...a) },
}));

import { AggregationRepository } from "../aggregation.repository";

const USER = "u1";
const CONTEST = "c1";
const EDITAL = "e1";
const POSITION = "p1";

/** Renderiza uma condição Drizzle (SQL) para texto, para inspecionar o filtro. */
function renderSql(cond: unknown): string {
  if (cond == null) return "";
  if (typeof cond === "string") return cond;
  const c = cond as {
    queryChunks?: unknown[];
    value?: unknown;
    isStream?: boolean;
    table?: { name?: string };
    name?: string;
  };
  if (Array.isArray(c.queryChunks)) return c.queryChunks.map(renderSql).join("");
  // Param do Drizzle: { value, isStream, encoder }
  if ("isStream" in (cond as object) && "value" in (cond as object)) {
    return String(c.value);
  }
  // StringChunk interno do Drizzle: { value, getSQL }
  if (typeof c.value === "string" && !Array.isArray(c.queryChunks)) {
    return c.value;
  }
  // Column do Drizzle: { table, name }
  if (c.table && c.name) return `"${c.table.name ?? c.table}"."${c.name}"`;
  return String(cond);
}

/** Constrói um mock de query Drizzle encadeado (select → from → where → limit). */
function makeQuery(result: unknown[]) {
  const limitMock = vi.fn().mockResolvedValue(result);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  return { from: fromMock };
}

/** Captura as condições passadas a cada .where() na ordem das queries. */
function capturedWhereConds(queries: unknown[]): unknown[][] {
  return queries.map((q) => {
    const whereMock = (q as { from: () => { where: ReturnType<typeof vi.fn> } })
      .from()
      .where as ReturnType<typeof vi.fn>;
    return whereMock.mock.calls[0] ?? [];
  });
}

/** Configura a sequência de selects: [perfil, edital, notice_rows...]. */
function setupSelects(queries: unknown[]) {
  mockSelect.mockReset();
  queries.forEach((q) => mockSelect.mockReturnValueOnce(q));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AggregationRepository.getEditalContext", () => {
  it("sem contest_id no perfil → null (neutro)", async () => {
    setupSelects([
      makeQuery([{ contestId: null, positionId: null }]),
    ]);

    const result = await AggregationRepository.getEditalContext(USER);
    expect(result).toBeNull();
    // Não deve consultar edital nem notice_subjects.
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it("sem edital publicado + is_current do concurso → null (neutro)", async () => {
    setupSelects([
      makeQuery([{ contestId: CONTEST, positionId: null }]),
      makeQuery([]), // nenhum edital vigente
    ]);

    const result = await AggregationRepository.getEditalContext(USER);
    expect(result).toBeNull();
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it("position_id NULL → pesos gerais (position_id NULL)", async () => {
    const qProfile = makeQuery([{ contestId: CONTEST, positionId: null }]);
    const qEdital = makeQuery([{ id: EDITAL }]);
    const qNotice = makeQuery([
      { knowledgeSubjectId: "ks1", weight: 40 },
      { knowledgeSubjectId: "ks2", weight: 60 },
    ]);
    setupSelects([qProfile, qEdital, qNotice]);

    const result = await AggregationRepository.getEditalContext(USER);
    expect(result).toEqual({
      contestId: CONTEST,
      positionId: null,
      rows: [
        { knowledgeSubjectId: "ks1", weight: 40 },
        { knowledgeSubjectId: "ks2", weight: 60 },
      ],
    });

    // Edital: filtra por contest + is_current + publicado + não deletado.
    const [editalConds] = capturedWhereConds([qEdital]);
    const editalSql = editalConds.map(renderSql).join(" AND ");
    expect(editalSql).toContain('"contest_id"');
    expect(editalSql).toContain('"is_current"');
    expect(editalSql).toContain("publicado");
    expect(editalSql).toContain('"deleted_at"');

    // Notice: escopo geral (position_id NULL) + edital + active + não deletado.
    const [noticeConds] = capturedWhereConds([qNotice]);
    const noticeSql = noticeConds.map(renderSql).join(" AND ");
    expect(noticeSql).toContain('"edital_id"');
    expect(noticeSql).toContain('"position_id"');
    expect(noticeSql).toContain("active");
    expect(noticeSql).toContain('"deleted_at"');
  });

  it("position_id preenchido → pesos do cargo específico", async () => {
    const qProfile = makeQuery([{ contestId: CONTEST, positionId: POSITION }]);
    const qEdital = makeQuery([{ id: EDITAL }]);
    const qNotice = makeQuery([
      { knowledgeSubjectId: "ks1", weight: 80 },
      { knowledgeSubjectId: "ks2", weight: 20 },
    ]);
    setupSelects([qProfile, qEdital, qNotice]);

    const result = await AggregationRepository.getEditalContext(USER);
    expect(result).toEqual({
      contestId: CONTEST,
      positionId: POSITION,
      rows: [
        { knowledgeSubjectId: "ks1", weight: 80 },
        { knowledgeSubjectId: "ks2", weight: 20 },
      ],
    });

    // Notice: escopo do cargo específico (position_id = POSITION).
    const [noticeConds] = capturedWhereConds([qNotice]);
    const noticeSql = noticeConds.map(renderSql).join(" AND ");
    expect(noticeSql).toContain(POSITION);
  });

  it("position_id preenchido sem pesos do cargo → fallback para pesos gerais", async () => {
    const qProfile = makeQuery([{ contestId: CONTEST, positionId: POSITION }]);
    const qEdital = makeQuery([{ id: EDITAL }]);
    const qNoticeCargo = makeQuery([]); // cargo específico: vazio
    const qNoticeGeral = makeQuery([
      { knowledgeSubjectId: "ks1", weight: 50 },
      { knowledgeSubjectId: "ks2", weight: 50 },
    ]); // fallback geral
    setupSelects([qProfile, qEdital, qNoticeCargo, qNoticeGeral]);

    const result = await AggregationRepository.getEditalContext(USER);
    expect(result).toEqual({
      contestId: CONTEST,
      positionId: POSITION,
      rows: [
        { knowledgeSubjectId: "ks1", weight: 50 },
        { knowledgeSubjectId: "ks2", weight: 50 },
      ],
    });

    // 1ª consulta notice: cargo específico; 2ª: fallback geral (position_id NULL).
    const [cargoConds] = capturedWhereConds([qNoticeCargo]);
    const [geralConds] = capturedWhereConds([qNoticeGeral]);
    expect(cargoConds.map(renderSql).join(" AND ")).toContain(POSITION);
    expect(geralConds.map(renderSql).join(" AND ")).toContain('"position_id"');
  });

  it("sem notice_subjects no escopo → null (neutro)", async () => {
    setupSelects([
      makeQuery([{ contestId: CONTEST, positionId: null }]),
      makeQuery([{ id: EDITAL }]),
      makeQuery([]), // nenhum notice_subject geral
    ]);

    const result = await AggregationRepository.getEditalContext(USER);
    expect(result).toBeNull();
  });

  it("position_id preenchido sem pesos do cargo E sem pesos gerais → null (neutro)", async () => {
    setupSelects([
      makeQuery([{ contestId: CONTEST, positionId: POSITION }]),
      makeQuery([{ id: EDITAL }]),
      makeQuery([]), // cargo específico: vazio
      makeQuery([]), // fallback geral: vazio
    ]);

    const result = await AggregationRepository.getEditalContext(USER);
    expect(result).toBeNull();
  });

  it("respeita weight = 0 (válido, não é ausência) e retorna o peso bruto", async () => {
    setupSelects([
      makeQuery([{ contestId: CONTEST, positionId: null }]),
      makeQuery([{ id: EDITAL }]),
      makeQuery([
        { knowledgeSubjectId: "ks1", weight: 0 },
        { knowledgeSubjectId: "ks2", weight: 100 },
      ]),
    ]);

    const result = await AggregationRepository.getEditalContext(USER);
    expect(result).toEqual({
      contestId: CONTEST,
      positionId: null,
      rows: [
        { knowledgeSubjectId: "ks1", weight: 0 },
        { knowledgeSubjectId: "ks2", weight: 100 },
      ],
    });
  });
});
