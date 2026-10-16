/**
 * POST /api/admin/catalog/analyze (FASE 4B).
 *
 * O contrato que importa: so admin entra; a saida de sucesso e uma proposta de
 * auditoria com applyStatus BLOCKED e zero operacoes de banco; fonte recusada vira
 * 422 com o motivo legivel; modo APPLY e aceito apenas para ser recusado; e a rota
 * nao faz rede nenhuma - nem para buscar a URL declarada, nem para chamar DeepSeek
 * quando a chave nao existe (a fabrica e mockada e devolve null).
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/administration/session", () => ({
  getAdminSession: (...args: unknown[]) => mockGetSession(...args),
}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/administration/services/admin-guard.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/administration/services/admin-guard.service")
  >();
  return {
    ...actual,
    AdminGuardService: { ...actual.AdminGuardService, requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a) },
  };
});

const mockCreateClient = vi.fn();
vi.mock("@/lib/catalog/services/deepseek-catalog-ai-client", () => ({
  createDeepSeekCatalogAiClient: (options?: unknown) => mockCreateClient(options),
}));

import { POST } from "@/app/api/admin/catalog/analyze/route";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import {
  NOVO_CURSO_2026_DECLARED_CONTEST,
  NOVO_CURSO_2026_EXTRACTION,
  NOVO_CURSO_2026_SOURCE,
  NOVO_CURSO_2026_TEXT,
} from "@/lib/catalog/agents/__tests__/novo-curso-2026.fixture";

function body(overrides: Record<string, unknown> = {}) {
  return {
    source: {
      type: "text",
      content: NOVO_CURSO_2026_TEXT,
      name: NOVO_CURSO_2026_SOURCE.name,
      label: NOVO_CURSO_2026_SOURCE.label,
      extractor: NOVO_CURSO_2026_SOURCE.extractor,
      capturedAt: NOVO_CURSO_2026_SOURCE.capturedAt,
      reviewedByHuman: true,
    },
    contest: NOVO_CURSO_2026_DECLARED_CONTEST,
    extraction: NOVO_CURSO_2026_EXTRACTION,
    mode: "AUDIT",
    ...overrides,
  };
}

function post(payload: unknown) {
  const request = new NextRequest("http://localhost:3000/api/admin/catalog/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return POST(request);
}

async function jsonOf(res: Response) {
  return await res.json();
}

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  mockGetSession.mockReset();
  mockRequireAdmin.mockReset();
  mockCreateClient.mockReset();
  mockGetSession.mockResolvedValue({ id: "admin-1" });
  mockRequireAdmin.mockResolvedValue(undefined);
  mockCreateClient.mockReturnValue(null);
  fetchSpy = vi.fn(async () => {
    throw new Error("rede nao permitida nesta fase");
  });
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("guard e entrada", () => {
  it("exige sessao de admin", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await post(body());
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("403 quando o guard recusa", async () => {
    mockRequireAdmin.mockRejectedValue(new AdminError("FORBIDDEN", "Sem papel de admin."));
    const res = await post(body());
    expect(res.status).toBe(403);
    const payload = await jsonOf(res);
    expect(payload.error).toBe("FORBIDDEN");
  });

  it("400 sem source", async () => {
    const res = await post({ mode: "AUDIT" });
    expect(res.status).toBe(400);
    const payload = await jsonOf(res);
    expect(Array.isArray(payload.details)).toBe(true);
  });

  it("400 quando sha256 declarado nao e sha256", async () => {
    const payload = body();
    (payload.source as Record<string, unknown>).declaredSha256 = "nao-e-hash";
    const res = await post(payload);
    expect(res.status).toBe(400);
  });
});

describe("auditoria", () => {
  it("devolve proposta de catalogo com apply bloqueado", async () => {
    const res = await post(body());
    expect(res.status).toBe(200);
    const payload = await jsonOf(res);
    expect(payload.status).toBe("AUDIT_COMPLETE");
    expect(payload.requestedMode).toBe("AUDIT");
    expect(payload.mode).toBe("audit-only");
    expect(payload.applyStatus).toBe("BLOCKED");
    expect(Object.keys(payload.proposal).sort()).toEqual([
      "collisions",
      "conflicts",
      "contest",
      "source",
      "subjects",
      "summary",
      "topics",
      "aiProposal",
    ].sort());
    expect(payload.applyRefusal.databaseOperations).toEqual([]);
    expect(payload.applyRefusal.code).toBe("APPLY_DISABLED_IN_AUDIT_PHASE");
    expect(payload.report).toContain("CATALOGO - NOVO CONCURSO");
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fecha a conta das classificacoes da fixture", async () => {
    const payload = await jsonOf(await post(body()));
    const summary = payload.summary ?? payload.proposal.summary;
    const total =
      summary.reuseCatalog + summary.newCanonical + summary.ambiguous + summary.blocked + summary.pendingReview;
    expect(total).toBe(summary.topicsFound);
    expect(summary.topicsFound).toBeGreaterThan(0);
    expect(summary.applyAllowed).toBe(false);
    expect(summary.byRule).toBeDefined();
  });

  it("422 com o motivo quando a fonte nao pode ser auditada", async () => {
    const res = await post(body({ source: { type: "text", content: "rotulo ausente e texto curto" } }));
    expect(res.status).toBe(422);
    const json = await jsonOf(res);
    expect(json.status).toBe("SOURCE_REFUSED");
    expect(json.blockingIssue.severity).toBe("blocking");
    expect(["SOURCE_PROVENANCE_INCOMPLETE", "SOURCE_EMPTY"]).toContain(json.blockingIssue.code);
  });

  it("modo APPLY e aceito apenas para ser recusado", async () => {
    const json = await jsonOf(await post(body({ mode: "APPLY" })));
    expect(json.status).toBe("AUDIT_COMPLETE");
    expect(json.requestedMode).toBe("APPLY");
    expect(json.mode).toBe("audit-only");
    expect(json.applyStatus).toBe("BLOCKED");
    expect(json.applyRefusal.refusedBypassFlags).toEqual(["mode"]);
    expect(json.applyRefusal.databaseOperations).toEqual([]);
  });

  it("ai=true sem chave degrada para AI_CLIENT_UNAVAILABLE sem mudar a decisao", async () => {
    const withoutAi = await jsonOf(await post(body()));
    const withAi = await jsonOf(await post(body({ ai: true, maxAiCandidates: 5 })));
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(withAi.status).toBe("AUDIT_COMPLETE");
    expect(withAi.proposal.aiProposal.skippedReason).toBe("AI_CLIENT_UNAVAILABLE");
    expect(withAi.proposal.topics.map((item: { classification: string }) => item.classification)).toEqual(
      withoutAi.proposal.topics.map((item: { classification: string }) => item.classification)
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});