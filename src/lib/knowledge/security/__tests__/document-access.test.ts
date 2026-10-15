/**
 * Politica central de leitura de documentos de conhecimento (piloto B1/B2).
 *
 * Cobre a decisao linha a linha e a condicao SQL que busca, listagens e rotas
 * compartilham: dono sempre le; documento com escopo valido le dentro do mesmo
 * cargo/edital; documento sem escopo nunca fica publico; admin le tudo.
 */
import { describe, it, expect } from "vitest";
import {
  accessScopeFromProfile,
  canAccessDocument,
  documentAccessCondition,
  isSharedDocument,
} from "../document-access";

/** Renderiza a condicao Drizzle em texto, para inspecionar o WHERE gerado. */
function renderSql(cond: unknown): string {
  if (cond == null) return "";
  if (typeof cond === "string") return cond;
  if (Array.isArray(cond)) return cond.map(renderSql).join(",");
  const c = cond as {
    queryChunks?: unknown[];
    value?: unknown[];
    table?: { name?: string };
    name?: string;
  };
  if (Array.isArray(c.queryChunks)) return c.queryChunks.map(renderSql).join("");
  if (Array.isArray(c.value)) return c.value.join("");
  if (typeof c.value === "string") return c.value;
  if (c.table && c.name) return `"${c.table.name}"."${c.name}"`;
  return String(cond);
}

const OWNER = "00000000-0000-4000-8000-0000000000aa";
const STUDENT = "00000000-0000-4000-8000-0000000000bb";
const POS_A = "00000000-0000-4000-8000-0000000000c1";
const POS_B = "00000000-0000-4000-8000-0000000000c2";
const EDITAL_A = "00000000-0000-4000-8000-0000000000d1";

function doc(overrides: Record<string, unknown> = {}) {
  return {
    userId: OWNER,
    positionId: null as string | null,
    editalId: null as string | null,
    ...overrides,
  };
}

describe("canAccessDocument", () => {
  it("dono le documento privado", () => {
    expect(canAccessDocument(doc(), { userId: OWNER })).toBe(true);
  });

  it("aluno do mesmo cargo le documento compartilhado", () => {
    const shared = doc({ positionId: POS_A });
    expect(canAccessDocument(shared, { userId: STUDENT, positionId: POS_A })).toBe(true);
  });

  it("aluno de outro cargo nao le", () => {
    const shared = doc({ positionId: POS_A });
    expect(canAccessDocument(shared, { userId: STUDENT, positionId: POS_B })).toBe(false);
  });

  it("aluno sem cargo usa o edital vigente do concurso", () => {
    const shared = doc({ editalId: EDITAL_A });
    expect(canAccessDocument(shared, { userId: STUDENT, editalId: EDITAL_A })).toBe(true);
    expect(canAccessDocument(shared, { userId: STUDENT, editalId: null })).toBe(false);
  });

  it("documento sem escopo nao fica publico", () => {
    expect(canAccessDocument(doc(), { userId: STUDENT, positionId: POS_A })).toBe(false);
    expect(canAccessDocument(doc(), { userId: STUDENT })).toBe(false);
  });

  it("aluno com escopo continua lendo os proprios documentos sem escopo", () => {
    const own = doc({ userId: STUDENT });
    expect(canAccessDocument(own, { userId: STUDENT, positionId: POS_A })).toBe(true);
  });

  it("admin le tudo, inclusive documento privado de outro usuario", () => {
    expect(canAccessDocument(doc(), { userId: STUDENT, isStaff: true })).toBe(true);
  });

  it("isSharedDocument so e verdadeiro com cargo ou edital", () => {
    expect(isSharedDocument(doc())).toBe(false);
    expect(isSharedDocument(doc({ positionId: POS_A }))).toBe(true);
    expect(isSharedDocument(doc({ editalId: EDITAL_A }))).toBe(true);
  });
});

describe("documentAccessCondition", () => {
  it("admin nao impoe restricao", () => {
    expect(documentAccessCondition({ userId: STUDENT, isStaff: true })).toBeUndefined();
  });

  it("usuario sem escopo filtrado apenas por posse", () => {
    const sql = renderSql(documentAccessCondition({ userId: STUDENT }));
    expect(sql).toContain(`"user_id"`);
    expect(sql).not.toContain(`"position_id"`);
    expect(sql).not.toContain(`"edital_id"`);
  });

  it("com cargo, abre OR entre posse e compartilhamento", () => {
    const sql = renderSql(
      documentAccessCondition({ userId: STUDENT, positionId: POS_A })
    );
    expect(sql).toContain(`"user_id"`);
    expect(sql).toContain(`"position_id"`);
    expect(sql.toLowerCase()).toContain(" or ");
  });

  it("com edital, o compartilhamento usa edital_id", () => {
    const sql = renderSql(
      documentAccessCondition({ userId: STUDENT, editalId: EDITAL_A })
    );
    expect(sql).toContain(`"edital_id"`);
    expect(sql).toContain(`"user_id"`);
  });
});

describe("accessScopeFromProfile", () => {
  it("pe o cargo do perfil ja carregado", () => {
    const scope = accessScopeFromProfile(STUDENT, { position_id: POS_A });
    expect(scope).toEqual({
      userId: STUDENT,
      positionId: POS_A,
      editalId: null,
      isStaff: false,
    });
  });

  it("perfil ausente nao inventa escopo", () => {
    const scope = accessScopeFromProfile(STUDENT, null, { isStaff: true });
    expect(scope.positionId).toBeNull();
    expect(scope.isStaff).toBe(true);
  });
});