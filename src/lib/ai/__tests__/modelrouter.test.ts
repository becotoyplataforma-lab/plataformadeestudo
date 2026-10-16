import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock do módulo env para isolar MODELROUTER_API_KEY do ambiente real.
// O módulo env (@/lib/env) cacheia o valor no import; sem mock, uma
// MODELROUTER_API_KEY definida como variável de ambiente do SISTEMA vazaria
// para env.MODELROUTER_API_KEY e quebraria o teste de "sem chave".
const envMock = vi.hoisted(() => ({
  env: {
    MODELROUTER_API_KEY: undefined as string | undefined,
    MODELROUTER_BASE_URL: "https://modelrouter.id/v1",
  },
}));

vi.mock("@/lib/env", () => envMock);

import { ModelRouterClient } from "../modelrouter";
import { REDACTED_PLACEHOLDER } from "@/lib/observability";

describe("ModelRouterClient", () => {
  const originalKey = process.env.MODELROUTER_API_KEY;

  beforeEach(() => {
    // Garante estado limpo: sem chave no env mockado nem no process.env.
    envMock.env.MODELROUTER_API_KEY = undefined;
    delete process.env.MODELROUTER_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalKey === undefined) delete process.env.MODELROUTER_API_KEY;
    else process.env.MODELROUTER_API_KEY = originalKey;
  });

  it("lista e ordena os modelos retornados pela API ModelRouter", async () => {
    const testKey = "modelrouter-test-key";
    envMock.env.MODELROUTER_API_KEY = testKey;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ data: [{ id: "gpt-4o-mini" }, { id: "claude-3-5-sonnet" }] }),
        { status: 200 }
      )
    );

    await expect(ModelRouterClient.listModels()).resolves.toEqual([
      "claude-3-5-sonnet",
      "gpt-4o-mini",
    ]);
    expect(fetch).toHaveBeenCalledWith(
      "https://modelrouter.id/v1/models",
      expect.objectContaining({ headers: { Authorization: `Bearer ${testKey}` } })
    );
  });

  it("retorna lista vazia sem chave, sem chamar a API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(ModelRouterClient.listModels()).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("isConfigured reflete a presença da chave", () => {
    expect(ModelRouterClient.isConfigured()).toBe(false);
    envMock.env.MODELROUTER_API_KEY = "alguma-chave";
    expect(ModelRouterClient.isConfigured()).toBe(true);
  });

  /**
   * Q1 - o corpo do gateway é texto não confirmado e as rotas de administração
   * devolvem `error.message` ao utilizador. O recheio de 250 caracteres empurra o
   * JWT para depois do limite de 300 do truncamento: se alguém inverter a ordem
   * para truncar-antes-de-redigir, o token chega partido ao filtro e o padrão
   * `JWT_LIKE` (que exige os três segmentos) já não o apanha. Os três testes
   * abaixo falham nessa regressão, em cada ponto de saída do cliente.
   */
  const JWT =
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtb2RlbHJvdXRlciIsImV4cCI6MTc5MDAwMDAwMH0.sRq7tV2wP1mZ9xK4bN6cL8dF0gH3jK5lM2nQ4pR6sT8";
  const recheio = "x".repeat(250);

  const saidasDoGateway: Array<[string, () => Promise<unknown>]> = [
    ["listModels", () => ModelRouterClient.listModels()],
    [
      "complete",
      () =>
        ModelRouterClient.complete({
          model: "flash",
          messages: [{ role: "user", content: "ping" }],
        }),
    ],
    [
      "streamChatCompletion",
      () =>
        ModelRouterClient.streamChatCompletion({
          model: "flash",
          messages: [{ role: "user", content: "ping" }],
        }),
    ],
  ];

  for (const [nome, chamada] of saidasDoGateway) {
    it(`${nome} redige o JWT do corpo do gateway antes de truncar`, async () => {
      envMock.env.MODELROUTER_API_KEY = "gateway-test-key";
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(`${recheio} ${JWT}`, { status: 502 })
      );

      const erro = (await chamada().catch((err: unknown) => err)) as Error;

      expect(erro).toBeInstanceOf(Error);
      expect(erro.message).toContain("ModelRouter API erro 502:");
      expect(erro.message).not.toMatch(/eyJ[A-Za-z0-9_-]{8,}/);
      expect(erro.message).not.toContain(JWT);
      expect(erro.message).toContain(REDACTED_PLACEHOLDER);
    });
  }

  it("mantém o corpo diagnóstico até ao limite de 300 caracteres", async () => {
    envMock.env.MODELROUTER_API_KEY = "gateway-test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("y".repeat(5000), { status: 503 })
    );

    const erro = (await ModelRouterClient.listModels().catch(
      (err: unknown) => err
    )) as Error;

    expect(erro.message.length).toBeLessThanOrEqual(
      "ModelRouter API erro 503: ".length + 300
    );
    expect(erro.message).toContain("yyyy");
  });
});
