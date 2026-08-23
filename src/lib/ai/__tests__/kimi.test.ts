import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock do módulo env para isolar KIMI_API_KEY do ambiente real.
// O módulo env (@/lib/env) cacheia o valor no import; sem mock, uma
// KIMI_API_KEY definida como variável de ambiente do SISTEMA vazaria
// para env.KIMI_API_KEY e quebraria o teste de "sem chave".
const envMock = vi.hoisted(() => ({
  env: {
    KIMI_API_KEY: undefined as string | undefined,
    KIMI_BASE_URL: "https://api.moonshot.ai/v1",
  },
}));

vi.mock("@/lib/env", () => envMock);

import { KimiService } from "../kimi";

describe("KimiService", () => {
  const originalKey = process.env.KIMI_API_KEY;

  beforeEach(() => {
    // Garante estado limpo: sem chave no env mockado nem no process.env.
    envMock.env.KIMI_API_KEY = undefined;
    delete process.env.KIMI_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalKey === undefined) delete process.env.KIMI_API_KEY;
    else process.env.KIMI_API_KEY = originalKey;
  });

  it("lista e ordena os modelos retornados pela API Kimi", async () => {
    const testKey = "kimi-test-key";
    envMock.env.KIMI_API_KEY = testKey;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "kimi-k2" }, { id: "moonshot-v1" }] }), {
        status: 200,
      })
    );

    await expect(KimiService.listModels()).resolves.toEqual(["kimi-k2", "moonshot-v1"]);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.moonshot.ai/v1/models",
      expect.objectContaining({ headers: { Authorization: `Bearer ${testKey}` } })
    );
  });

  it("retorna lista vazia sem chave, sem chamar a API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(KimiService.listModels()).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});