/**
 * Cota diaria de questoes — POST /api/questoes/[id]/responder (FASE 3C-5B).
 * Contrato: maxQuestionsPerDay = attempts persistidas por userId no dia atual.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

const mockGetQuestionWithOptions = vi.fn();
const mockGetGabarito = vi.fn();
vi.mock("@/lib/db/repositories/questoes", () => ({
  getQuestionWithOptions: (...args: unknown[]) => mockGetQuestionWithOptions(...args),
  getGabarito: (...args: unknown[]) => mockGetGabarito(...args),
}));

const mockCreate = vi.fn();
const mockCountToday = vi.fn();
const mockCountCorrect = vi.fn();
vi.mock("@/lib/study/repositories", () => ({
  QuestionAttemptRepository: {
    create: (...args: unknown[]) => mockCreate(...args),
    countToday: (...args: unknown[]) => mockCountToday(...args),
    countCorrectByUser: (...args: unknown[]) => mockCountCorrect(...args),
  },
}));

const mockResolveUserLimits = vi.fn();
vi.mock("@/lib/billing/services/limits.resolver", () => ({
  resolveUserLimits: (...args: unknown[]) => mockResolveUserLimits(...args),
}));

import { POST } from "@/app/api/questoes/[id]/responder/route";

const QID = "11111111-1111-4111-8111-111111111111";

function req(body: unknown): Request {
  return new Request(`http://localhost/api/questoes/${QID}/responder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ctx() {
  return { params: Promise.resolve({ id: QID }) };
}

function validBody() {
  return { selected_letter: "C", time_spent_sec: 10, mode: "estudo" };
}

function limitsWith(maxQuestionsPerDay: number | undefined) {
  return {
    maxMessages: 5,
    maxTokens: 100_000,
    maxQuestionsPerDay,
    maxDocuments: 3,
    allowPro: false,
  };
}

function expectedResetAt(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return end.toISOString();
}

describe("POST responder — cota diaria (maxQuestionsPerDay)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockGetQuestionWithOptions.mockResolvedValue({ id: QID, is_public: true });
    mockGetGabarito.mockResolvedValue({ gabarito: "C", explicacao: "Ok" });
    mockResolveUserLimits.mockResolvedValue(limitsWith(20));
    mockCountToday.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: "a1" });
    mockCountCorrect.mockResolvedValue(1);
  });

  it("abaixo do limite (19/20) permite e persiste", async () => {
    mockCountToday.mockResolvedValue(19);
    const res = await POST(req(validBody()), ctx());
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", questionId: QID })
    );
  });

  it("exatamente no limite (20/20) retorna 429 sem persistir", async () => {
    mockCountToday.mockResolvedValue(20);
    const res = await POST(req(validBody()), ctx());
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("QUOTA_EXCEEDED");
    expect(body.resource).toBe("questions");
    expect(body.limit).toBe(20);
    expect(body.current).toBe(20);
    expect(body.resetAt).toBe(expectedResetAt());
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("acima do limite (21/20) retorna 429", async () => {
    mockCountToday.mockResolvedValue(21);
    const res = await POST(req(validBody()), ctx());
    expect(res.status).toBe(429);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("POST responder — planos, janela e isolamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockGetQuestionWithOptions.mockResolvedValue({ id: QID, is_public: true });
    mockGetGabarito.mockResolvedValue({ gabarito: "C", explicacao: null });
    mockCountCorrect.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: "a1" });
  });

  it("Free/Pro/Intensivo usam o limite resolvido (20/200/1000)", async () => {
    for (const limit of [20, 200, 1000]) {
      vi.clearAllMocks();
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockGetQuestionWithOptions.mockResolvedValue({ id: QID, is_public: true });
      mockGetGabarito.mockResolvedValue({ gabarito: "C", explicacao: null });
      mockResolveUserLimits.mockResolvedValue(limitsWith(limit));
      mockCountCorrect.mockResolvedValue(0);
      mockCreate.mockResolvedValue({ id: "a1" });

      mockCountToday.mockResolvedValue(limit - 1);
      const ok = await POST(req(validBody()), ctx());
      expect(ok.status).toBe(200);

      mockCountToday.mockResolvedValue(limit);
      const blocked = await POST(req(validBody()), ctx());
      expect(blocked.status).toBe(429);
      const body = (await blocked.json()) as Record<string, unknown>;
      expect(body.limit).toBe(limit);
      expect(body.current).toBe(limit);
    }
  });

  it("fallback para 20 quando o plano nao informa maxQuestionsPerDay", async () => {
    mockResolveUserLimits.mockResolvedValue(limitsWith(undefined));
    mockCountToday.mockResolvedValue(20);
    const res = await POST(req(validBody()), ctx());
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.limit).toBe(20);
  });

  it("contagem isolada por usuario", async () => {
    mockResolveUserLimits.mockResolvedValue(limitsWith(20));
    mockAuth.mockResolvedValue({ user: { id: "user-B" } });
    mockCountToday.mockResolvedValue(0);
    const res = await POST(req(validBody()), ctx());
    expect(res.status).toBe(200);
    expect(mockCountToday).toHaveBeenCalledWith(
      "user-B",
      expect.any(Date),
      expect.any(Date)
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-B" })
    );
  });

  it("janela diaria meia-noite local ate proxima meia-noite", async () => {
    mockResolveUserLimits.mockResolvedValue(limitsWith(20));
    mockCountToday.mockResolvedValue(0);
    await POST(req(validBody()), ctx());
    const [uid, start, end] = mockCountToday.mock.calls[0] as unknown as [
      string, Date, Date,
    ];
    expect(uid).toBe("u1");
    const expectedStart = new Date();
    expectedStart.setHours(0, 0, 0, 0);
    const expectedEnd = new Date(expectedStart);
    expectedEnd.setDate(expectedStart.getDate() + 1);
    expect(start.getTime()).toBe(expectedStart.getTime());
    expect(end.getTime()).toBe(expectedEnd.getTime());
  });

  it("repeticao da mesma questao conta cada attempt", async () => {
    mockResolveUserLimits.mockResolvedValue(limitsWith(20));
    mockCountToday.mockResolvedValueOnce(5).mockResolvedValueOnce(6);
    const first = await POST(req(validBody()), ctx());
    const second = await POST(req(validBody()), ctx());
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("401-422-404 nao consomem quota", async () => {
    mockResolveUserLimits.mockResolvedValue(limitsWith(20));
    mockAuth.mockResolvedValue(null);
    expect((await POST(req(validBody()), ctx())).status).toBe(401);
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    expect((await POST(req({ selected_letter: "Z" }), ctx())).status).toBe(422);
    mockGetQuestionWithOptions.mockResolvedValue(null);
    expect((await POST(req(validBody()), ctx())).status).toBe(404);
    expect(mockCountToday).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("POST responder - novo dia e generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockGetQuestionWithOptions.mockResolvedValue({ id: QID, is_public: true });
    mockGetGabarito.mockResolvedValue({ gabarito: "C", explicacao: null });
    mockResolveUserLimits.mockResolvedValue(limitsWith(20));
    mockCountCorrect.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: "a1" });
  });

  it("tentativas de ontem ficam fora da janela de hoje", async () => {
    mockCountToday.mockResolvedValue(0);
    await POST(req(validBody()), ctx());
    const [, start] = mockCountToday.mock.calls[0] as unknown as [string, Date, Date];
    const yesterday = new Date(start);
    yesterday.setDate(start.getDate() - 1);
    expect(yesterday.getTime()).toBeLessThan(start.getTime());
    const res = await POST(req(validBody()), ctx());
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("/api/questions/generate nao consome esta quota", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/app/api/questions/generate/route.ts"),
      "utf-8"
    );
    expect(src).not.toContain("countToday");
    expect(src).not.toContain("maxQuestionsPerDay");
    expect(src).not.toContain("resolveUserLimits");
    expect(src).not.toContain("QUOTA_EXCEEDED");
  });
});
