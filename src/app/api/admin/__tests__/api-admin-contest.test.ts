/**
 * Testes das API routes /api/admin/contests, /api/admin/positions e /api/admin/organs-boards.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
    AdminGuardService: {
      ...actual.AdminGuardService,
      requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
    },
  };
});

const mockContestList = vi.fn();
const mockContestCreate = vi.fn();
const mockContestUpdate = vi.fn();
const mockContestSoftDelete = vi.fn();
vi.mock("@/lib/administration/services/contest.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/administration/services/contest.service")>();
  return {
    ...actual,
    ContestService: {
      list: (...a: unknown[]) => mockContestList(...a),
      create: (...a: unknown[]) => mockContestCreate(...a),
      update: (...a: unknown[]) => mockContestUpdate(...a),
      softDelete: (...a: unknown[]) => mockContestSoftDelete(...a),
    },
  };
});

const mockPositionList = vi.fn();
const mockPositionCreate = vi.fn();
const mockPositionUpdate = vi.fn();
const mockPositionSoftDelete = vi.fn();
vi.mock("@/lib/administration/services/position.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/administration/services/position.service")>();
  return {
    ...actual,
    PositionService: {
      listByContest: (...a: unknown[]) => mockPositionList(...a),
      create: (...a: unknown[]) => mockPositionCreate(...a),
      update: (...a: unknown[]) => mockPositionUpdate(...a),
      softDelete: (...a: unknown[]) => mockPositionSoftDelete(...a),
    },
  };
});

const mockOrganBoardList = vi.fn();
const mockOrganBoardCreate = vi.fn();
vi.mock("@/lib/administration/services/organ-board.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/administration/services/organ-board.service")>();
  return {
    ...actual,
    OrganBoardService: {
      list: (...a: unknown[]) => mockOrganBoardList(...a),
      create: (...a: unknown[]) => mockOrganBoardCreate(...a),
    },
  };
});

import { GET as getContests, POST as postContests } from "@/app/api/admin/contests/route";
import {
  PATCH as patchContest,
  DELETE as deleteContest,
} from "@/app/api/admin/contests/[id]/route";
import { GET as getPositions, POST as postPositions } from "@/app/api/admin/positions/route";
import {
  PATCH as patchPosition,
  DELETE as deletePosition,
} from "@/app/api/admin/positions/[id]/route";
import { GET as getOrgansBoards, POST as postOrgansBoards } from "@/app/api/admin/organs-boards/route";
import { ContestError } from "@/lib/administration/services/contest.service";
import { PositionError } from "@/lib/administration/services/position.service";
import { OrganBoardError } from "@/lib/administration/services/organ-board.service";
import { AdminError } from "@/lib/administration/services/admin-guard.service";

const ADMIN = { userId: "a1", email: "admin@x.com" };
const ORGAN_ID = "11111111-1111-4111-8111-111111111111";
const BOARD_ID = "22222222-2222-4222-8222-222222222222";
const CONTEST_ID = "33333333-3333-4333-8333-333333333333";
const ROW = {
  id: CONTEST_ID,
  organId: ORGAN_ID,
  boardId: BOARD_ID,
  title: "Concurso PMERJ",
  slug: "concurso-pmerj",
  description: null,
  status: "rascunho",
  startDate: null,
  endDate: null,
  createdAt: "2026-08-22T17:34:35.165Z",
  updatedAt: "2026-08-22T17:34:35.165Z",
  deletedAt: null,
};
const POS_ROW = {
  id: "44444444-4444-4444-8444-444444444444",
  contestId: CONTEST_ID,
  editalId: null,
  name: "Soldado PM",
  slug: "soldado-pm",
  description: null,
  status: "active",
  createdAt: "2026-08-22T17:34:35.165Z",
  updatedAt: "2026-08-22T17:34:35.165Z",
  deletedAt: null,
};
const ORG_ROW = { id: ORGAN_ID, name: "PMERJ", slug: "pmerj" };

function jsonReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/contests", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("API /api/admin/contests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(ADMIN);
    mockRequireAdmin.mockResolvedValue(undefined);
    mockContestList.mockResolvedValue([ROW]);
    mockContestCreate.mockResolvedValue(ROW);
    mockContestUpdate.mockResolvedValue(ROW);
    mockContestSoftDelete.mockResolvedValue(ROW);
  });

  it("GET sem sessão → 401", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await getContests();
    expect(res.status).toBe(401);
  });

  it("GET não-admin → 403", async () => {
    mockRequireAdmin.mockRejectedValue(new AdminError("FORBIDDEN", "Acesso restrito a administradores."));
    const res = await getContests();
    expect(res.status).toBe(403);
  });

  it("GET admin → 200 com lista", async () => {
    const res = await getContests();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([ROW]);
  });

  it("POST cria concurso → 201", async () => {
    const res = await postContests(
      jsonReq({ organ_id: ORGAN_ID, board_id: BOARD_ID, title: "Concurso PMERJ" })
    );
    expect(res.status).toBe(201);
    expect(mockContestCreate).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({ title: "Concurso PMERJ", status: undefined })
    );
  });

  it("POST body inválido → 400", async () => {
    const res = await postContests(jsonReq({ title: "x" }));
    expect(res.status).toBe(400);
    expect(mockContestCreate).not.toHaveBeenCalled();
  });

  it("POST duplicado → 409", async () => {
    mockContestCreate.mockRejectedValue(
      new ContestError("DUPLICATE_SLUG", "Já existe um concurso com este slug.")
    );
    const res = await postContests(
      jsonReq({ organ_id: ORGAN_ID, board_id: BOARD_ID, title: "Concurso PMERJ" })
    );
    expect(res.status).toBe(409);
  });

  it("POST sem permissão → 403", async () => {
    mockRequireAdmin.mockRejectedValue(new AdminError("FORBIDDEN", "Acesso restrito a administradores."));
    const res = await postContests(
      jsonReq({ organ_id: ORGAN_ID, board_id: BOARD_ID, title: "Concurso PMERJ" })
    );
    expect(res.status).toBe(403);
  });

  it("PATCH atualiza → 200", async () => {
    const req = new NextRequest("http://localhost/api/admin/contests/c1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Novo título" }),
      headers: { "content-type": "application/json" },
    });
    const res = await patchContest(req, { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    expect(mockContestUpdate).toHaveBeenCalledWith(ADMIN, "c1", expect.anything());
  });

  it("PATCH não encontrado → 404", async () => {
    mockContestUpdate.mockRejectedValue(new ContestError("NOT_FOUND", "Concurso não encontrado."));
    const req = new NextRequest("http://localhost/api/admin/contests/x", {
      method: "PATCH",
      body: JSON.stringify({ title: "Novo" }),
      headers: { "content-type": "application/json" },
    });
    const res = await patchContest(req, { params: Promise.resolve({ id: "x" }) });
    expect(res.status).toBe(404);
  });

  it("DELETE soft delete → 200", async () => {
    const req = new NextRequest("http://localhost/api/admin/contests/c1", { method: "DELETE" });
    const res = await deleteContest(req, { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    expect(mockContestSoftDelete).toHaveBeenCalledWith(ADMIN, "c1");
  });
});

describe("API /api/admin/positions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(ADMIN);
    mockRequireAdmin.mockResolvedValue(undefined);
    mockPositionList.mockResolvedValue([POS_ROW]);
    mockPositionCreate.mockResolvedValue(POS_ROW);
    mockPositionUpdate.mockResolvedValue(POS_ROW);
    mockPositionSoftDelete.mockResolvedValue(POS_ROW);
  });

  it("GET sem contest_id → 400", async () => {
    const req = new NextRequest("http://localhost/api/admin/positions", { method: "GET" });
    const res = await getPositions(req);
    expect(res.status).toBe(400);
  });

  it("GET com contest_id → 200", async () => {
    const req = new NextRequest("http://localhost/api/admin/positions?contest_id=c1", {
      method: "GET",
    });
    const res = await getPositions(req);
    expect(res.status).toBe(200);
    expect(mockPositionList).toHaveBeenCalledWith(ADMIN, "c1");
  });

  it("POST cria cargo → 201", async () => {
    const req = new NextRequest("http://localhost/api/admin/positions", {
      method: "POST",
      body: JSON.stringify({ contest_id: CONTEST_ID, name: "Soldado PM" }),
      headers: { "content-type": "application/json" },
    });
    const res = await postPositions(req);
    expect(res.status).toBe(201);
    expect(mockPositionCreate).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({ contestId: CONTEST_ID, name: "Soldado PM" })
    );
  });

  it("POST duplicado → 409", async () => {
    mockPositionCreate.mockRejectedValue(
      new PositionError("DUPLICATE_SLUG", "Já existe um cargo com este nome neste concurso.")
    );
    const req = new NextRequest("http://localhost/api/admin/positions", {
      method: "POST",
      body: JSON.stringify({ contest_id: CONTEST_ID, name: "Soldado PM" }),
      headers: { "content-type": "application/json" },
    });
    const res = await postPositions(req);
    expect(res.status).toBe(409);
  });

  it("PATCH atualiza → 200", async () => {
    const req = new NextRequest("http://localhost/api/admin/positions/p1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Soldado PM 2026" }),
      headers: { "content-type": "application/json" },
    });
    const res = await patchPosition(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);
    expect(mockPositionUpdate).toHaveBeenCalledWith(ADMIN, "p1", expect.anything());
  });

  it("DELETE soft delete → 200", async () => {
    const req = new NextRequest("http://localhost/api/admin/positions/p1", { method: "DELETE" });
    const res = await deletePosition(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);
    expect(mockPositionSoftDelete).toHaveBeenCalledWith(ADMIN, "p1");
  });
});

describe("API /api/admin/organs-boards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(ADMIN);
    mockRequireAdmin.mockResolvedValue(undefined);
    mockOrganBoardList.mockResolvedValue({ organs: [ORG_ROW], boards: [] });
    mockOrganBoardCreate.mockResolvedValue(ORG_ROW);
  });

  it("GET → 200 com órgãos e bancas", async () => {
    const res = await getOrgansBoards();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.organs).toEqual([ORG_ROW]);
  });

  it("POST cria órgão → 201", async () => {
    const req = new NextRequest("http://localhost/api/admin/organs-boards", {
      method: "POST",
      body: JSON.stringify({ type: "organ", name: "PMERJ" }),
      headers: { "content-type": "application/json" },
    });
    const res = await postOrgansBoards(req);
    expect(res.status).toBe(201);
    expect(mockOrganBoardCreate).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({ type: "organ", name: "PMERJ" })
    );
  });

  it("POST type inválido → 400", async () => {
    const req = new NextRequest("http://localhost/api/admin/organs-boards", {
      method: "POST",
      body: JSON.stringify({ type: "banco", name: "X" }),
      headers: { "content-type": "application/json" },
    });
    const res = await postOrgansBoards(req);
    expect(res.status).toBe(400);
  });

  it("POST duplicado → 409", async () => {
    mockOrganBoardCreate.mockRejectedValue(
      new OrganBoardError("DUPLICATE_SLUG", "Já existe um órgão com este nome.")
    );
    const req = new NextRequest("http://localhost/api/admin/organs-boards", {
      method: "POST",
      body: JSON.stringify({ type: "organ", name: "PMERJ" }),
      headers: { "content-type": "application/json" },
    });
    const res = await postOrgansBoards(req);
    expect(res.status).toBe(409);
  });
});
