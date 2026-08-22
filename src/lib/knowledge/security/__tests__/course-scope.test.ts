/**
 * Testes do isolamento de conhecimento por curso/cargo/edital
 * (src/lib/knowledge/security/course-scope.ts).
 *
 * Garante que um aluno só receba contexto de documentos do seu curso/cargo/
 * edital, e que o escopo seja resolvido a partir do perfil autenticado (backend).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Profile } from "@/types";

const mockGetCurrentEditalByContest = vi.fn();

vi.mock("@/lib/db/repositories/edital", () => ({
  getCurrentEditalByContest: (...args: unknown[]) =>
    mockGetCurrentEditalByContest(...args),
}));

import { resolveCourseScope, isDocInUserScope } from "../course-scope";

function profile(
  overrides: Partial<{ contest_id: string | null; position_id: string | null }> = {}
): Profile {
  return {
    id: "u1",
    full_name: "Aluno",
    email: null,
    avatar_url: null,
    plano: "free",
    nivel: "iniciante",
    concurso_alvo: null,
    banca_preferida: null,
    contest_id: null,
    position_id: null,
    meta_diaria_min: 10,
    modelo_ia_padrao: "flash",
    is_admin: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveCourseScope", () => {
  it("com position_id, retorna positionId como filtro principal", async () => {
    const scope = await resolveCourseScope(profile({ position_id: "pos-Y" }));
    expect(scope).toEqual({ positionId: "pos-Y" });
    expect(mockGetCurrentEditalByContest).not.toHaveBeenCalled();
  });

  it("sem position_id mas com contest_id, resolve edital vigente como fallback", async () => {
    mockGetCurrentEditalByContest.mockResolvedValue({ id: "edital-X" });
    const scope = await resolveCourseScope(profile({ contest_id: "contest-X" }));
    expect(mockGetCurrentEditalByContest).toHaveBeenCalledWith("contest-X");
    expect(scope).toEqual({ editalId: "edital-X" });
  });

  it("sem contest_id nem position_id, NÃO inventa filtro", async () => {
    const scope = await resolveCourseScope(profile());
    expect(scope).toEqual({});
    expect(mockGetCurrentEditalByContest).not.toHaveBeenCalled();
  });

  it("perfil nulo retorna escopo vazio", async () => {
    const scope = await resolveCourseScope(null);
    expect(scope).toEqual({});
  });
});

describe("isDocInUserScope", () => {
  it("com position_id, aceita documento do mesmo cargo", async () => {
    const ok = await isDocInUserScope(
      { positionId: "pos-Y", editalId: null },
      profile({ position_id: "pos-Y" })
    );
    expect(ok).toBe(true);
  });

  it("com position_id, rejeita documento de outro cargo", async () => {
    const ok = await isDocInUserScope(
      { positionId: "pos-B", editalId: null },
      profile({ position_id: "pos-Y" })
    );
    expect(ok).toBe(false);
  });

  it("com position_id, rejeita documento sem cargo (NULL)", async () => {
    const ok = await isDocInUserScope(
      { positionId: null, editalId: null },
      profile({ position_id: "pos-Y" })
    );
    expect(ok).toBe(false);
  });

  it("sem position_id mas com contest_id, aceita documento do edital vigente", async () => {
    mockGetCurrentEditalByContest.mockResolvedValue({ id: "edital-X" });
    const ok = await isDocInUserScope(
      { positionId: null, editalId: "edital-X" },
      profile({ contest_id: "contest-X" })
    );
    expect(ok).toBe(true);
  });

  it("sem position_id mas com contest_id, rejeita documento de outro edital", async () => {
    mockGetCurrentEditalByContest.mockResolvedValue({ id: "edital-X" });
    const ok = await isDocInUserScope(
      { positionId: null, editalId: "edital-OTHER" },
      profile({ contest_id: "contest-X" })
    );
    expect(ok).toBe(false);
  });

  it("sem contest_id nem position_id, aceita documento (sem escopo definido)", async () => {
    const ok = await isDocInUserScope(
      { positionId: null, editalId: null },
      profile()
    );
    expect(ok).toBe(true);
  });

  it("perfil nulo aceita documento (sem escopo definido)", async () => {
    const ok = await isDocInUserScope({ positionId: null, editalId: null }, null);
    expect(ok).toBe(true);
  });
});
