/**
 * Validacao de escopo de upload (cargo/edital) antes de qualquer escrita.
 *
 * O banco e mockado por fila de resultados: cada consulta espera uma linha.
 * Isso prova que id arbitrario, id inexistente, id excluido e par de concursos
 * diferentes sao recusados, e que o edital do cargo e reaproveitado quando o
 * upload nao informou edital.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  queue: [] as unknown[][],
  selectCalls: 0,
}));

vi.mock("@/lib/db/drizzle", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            state.selectCalls += 1;
            const rows = state.queue.shift() ?? [];
            return {
              then: (onFulfilled: (v: unknown) => unknown) =>
                Promise.resolve(onFulfilled(rows)),
            };
          },
        }),
      }),
    }),
  },
}));

import { ScopeError, validateDocumentScope } from "../document-scope";

const CONTEST_A = "00000000-0000-4000-8000-00000000aaaa";
const CONTEST_B = "00000000-0000-4000-8000-00000000bbbb";
const POSITION = "00000000-0000-4000-8000-00000000cccc";
const POSITION_NO_EDITAL = "00000000-0000-4000-8000-00000000cdcd";
const EDITAL = "00000000-0000-4000-8000-00000000eeee";
const EDITAL_OUTRO_CONCURSO = "00000000-0000-4000-8000-00000000ffff";

beforeEach(() => {
  state.queue = [];
  state.selectCalls = 0;
});

describe("validateDocumentScope", () => {
  it("sem ids nao consulta nada", async () => {
    await expect(validateDocumentScope({})).resolves.toEqual({
      positionId: null,
      editalId: null,
    });
    expect(state.selectCalls).toBe(0);
  });

  it("ids vazios em string sao tratados como ausentes", async () => {
    await expect(
      validateDocumentScope({ positionId: "  ", editalId: "" })
    ).resolves.toEqual({ positionId: null, editalId: null });
    expect(state.selectCalls).toBe(0);
  });

  it("recusa id fora do formato uuid", async () => {
    await expect(
      validateDocumentScope({ positionId: "cargo-admin" })
    ).rejects.toMatchObject({ code: "INVALID_SCOPE_ID" });
    expect(state.selectCalls).toBe(0);
  });

  it("recusa edital fora do formato uuid", async () => {
    await expect(
      validateDocumentScope({ editalId: "edital-1" })
    ).rejects.toMatchObject({ code: "INVALID_SCOPE_ID" });
  });

  it("recusa cargo inexistente ou excluido", async () => {
    state.queue = [[]];
    await expect(
      validateDocumentScope({ positionId: POSITION })
    ).rejects.toMatchObject({ code: "SCOPE_NOT_FOUND" });
  });

  it("recusa edital inexistente", async () => {
    state.queue = [[]];
    await expect(
      validateDocumentScope({ editalId: EDITAL })
    ).rejects.toMatchObject({ code: "SCOPE_NOT_FOUND" });
  });

  it("recusa cargo e edital de concursos diferentes", async () => {
    state.queue = [
      [{ id: POSITION, contestId: CONTEST_A, editalId: null }],
      [{ id: EDITAL_OUTRO_CONCURSO, contestId: CONTEST_B }],
    ];
    await expect(
      validateDocumentScope({
        positionId: POSITION,
        editalId: EDITAL_OUTRO_CONCURSO,
      })
    ).rejects.toMatchObject({ code: "SCOPE_MISMATCH" });
  });

  it("herda o edital do cargo quando o upload nao informou edital", async () => {
    state.queue = [[{ id: POSITION, contestId: CONTEST_A, editalId: EDITAL }]];
    await expect(validateDocumentScope({ positionId: POSITION })).resolves.toEqual({
      positionId: POSITION,
      editalId: EDITAL,
    });
  });

  it("cargo sem edital fica com escopo so de cargo", async () => {
    state.queue = [
      [{ id: POSITION_NO_EDITAL, contestId: CONTEST_A, editalId: null }],
    ];
    await expect(
      validateDocumentScope({ positionId: POSITION_NO_EDITAL })
    ).resolves.toEqual({ positionId: POSITION_NO_EDITAL, editalId: null });
  });

  it("aceita par valido do mesmo concurso sem reescrever o edital", async () => {
    state.queue = [
      [{ id: POSITION, contestId: CONTEST_A, editalId: null }],
      [{ id: EDITAL, contestId: CONTEST_A }],
    ];
    await expect(
      validateDocumentScope({ positionId: POSITION, editalId: EDITAL })
    ).resolves.toEqual({ positionId: POSITION, editalId: EDITAL });
  });

  it("o erro de dominio carrega codigo e mensagem", async () => {
    const error = await validateDocumentScope({ positionId: "nao-uuid" }).catch(
      (e) => e
    );
    expect(error).toBeInstanceOf(ScopeError);
    expect((error as ScopeError).message.length).toBeGreaterThan(0);
  });
});