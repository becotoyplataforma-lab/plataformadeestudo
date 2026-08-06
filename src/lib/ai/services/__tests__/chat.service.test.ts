/**
 * Testes do ChatService (orquestração) com dependências mockadas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindSession = vi.fn();
const mockCreateSession = vi.fn();
const mockTouch = vi.fn();
const mockCreateMessage = vi.fn();
const mockGetRecent = vi.fn();
const mockBuildSystem = vi.fn();
const mockBuildMessages = vi.fn();
const mockComplete = vi.fn();
const mockRecord = vi.fn();

vi.mock("../../repositories/chat.repository", () => ({
  ChatRepository: {
    findSessionById: (...a: unknown[]) => mockFindSession(...a),
    createSession: (...a: unknown[]) => mockCreateSession(...a),
    touchSession: (...a: unknown[]) => mockTouch(...a),
    createMessage: (...a: unknown[]) => mockCreateMessage(...a),
    getRecentContext: (...a: unknown[]) => mockGetRecent(...a),
  },
}));

vi.mock("../prompt.service", () => ({
  PromptService: {
    buildSystemPrompt: (...a: unknown[]) => mockBuildSystem(...a),
    buildMessages: (...a: unknown[]) => mockBuildMessages(...a),
  },
}));

vi.mock("../model-router.service", () => ({
  ModelRouterService: {
    route: () => "flash",
  },
}));

vi.mock("../deepseek-provider.service", () => ({
  DeepSeekProvider: {
    complete: (...a: unknown[]) => mockComplete(...a),
  },
}));

vi.mock("../usage.service", () => ({
  UsageService: {
    record: (...a: unknown[]) => mockRecord(...a),
    estimateCost: () => 0.01,
  },
}));

import { ChatService, ChatError } from "../chat.service";

describe("ChatService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria sessão nova quando session_id não informado", async () => {
    mockCreateSession.mockResolvedValue({ id: "s1", userId: "u1", model: "flash" });
    mockGetRecent.mockResolvedValue([]);
    mockBuildSystem.mockResolvedValue("system");
    mockBuildMessages.mockResolvedValue([{ role: "system", content: "system" }]);
    mockComplete.mockResolvedValue({
      content: "Olá!",
      model: "flash",
      tokensIn: 100,
      tokensOut: 20,
    });
    mockCreateMessage
      .mockResolvedValueOnce({ id: "m-user" })
      .mockResolvedValueOnce({ id: "m-assistant" });

    const result = await ChatService.send({
      userId: "u1",
      message: "Oi",
    });

    expect(result.sessionId).toBe("s1");
    expect(result.response).toBe("Olá!");
    expect(mockCreateSession).toHaveBeenCalled();
    expect(mockRecord).toHaveBeenCalledWith("u1", 100, 20);
  });

  it("lança SESSION_NOT_FOUND quando sessão não existe", async () => {
    mockFindSession.mockResolvedValue(null);
    await expect(
      ChatService.send({ userId: "u1", message: "Oi", sessionId: "sx" })
    ).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
  });

  it("reutiliza sessão existente", async () => {
    mockFindSession.mockResolvedValue({ id: "s1", userId: "u1", model: "flash" });
    mockTouch.mockResolvedValue({});
    mockGetRecent.mockResolvedValue([]);
    mockBuildSystem.mockResolvedValue("system");
    mockBuildMessages.mockResolvedValue([{ role: "system", content: "system" }]);
    mockComplete.mockResolvedValue({
      content: "Resposta",
      model: "flash",
      tokensIn: 10,
      tokensOut: 5,
    });
    mockCreateMessage
      .mockResolvedValueOnce({ id: "m-user" })
      .mockResolvedValueOnce({ id: "m-assistant" });

    const result = await ChatService.send({
      userId: "u1",
      message: "Oi",
      sessionId: "s1",
    });

    expect(result.sessionId).toBe("s1");
    expect(mockFindSession).toHaveBeenCalled();
    expect(mockTouch).toHaveBeenCalled();
  });

  it("retorna métricas de tokens e custo", async () => {
    mockCreateSession.mockResolvedValue({ id: "s1", userId: "u1", model: "flash" });
    mockGetRecent.mockResolvedValue([]);
    mockBuildSystem.mockResolvedValue("system");
    mockBuildMessages.mockResolvedValue([{ role: "system", content: "system" }]);
    mockComplete.mockResolvedValue({
      content: "X",
      model: "flash",
      tokensIn: 120,
      tokensOut: 30,
    });
    mockCreateMessage
      .mockResolvedValueOnce({ id: "m-user" })
      .mockResolvedValueOnce({ id: "m-assistant" });

    const result = await ChatService.send({ userId: "u1", message: "Oi" });

    expect(result.tokensIn).toBe(120);
    expect(result.tokensOut).toBe(30);
    expect(result.totalTokens).toBe(150);
    expect(result.costBRL).toBe(0.01);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
