import { afterEach, describe, expect, it, vi } from "vitest";
import { KimiService } from "../kimi";

describe("KimiService", () => {
  const originalKey = process.env.KIMI_API_KEY;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalKey === undefined) delete process.env.KIMI_API_KEY;
    else process.env.KIMI_API_KEY = originalKey;
  });

  it("lista e ordena os modelos retornados pela API Kimi", async () => {
    const testKey = "kimi-test-key";
    process.env.KIMI_API_KEY = testKey;
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
    delete process.env.KIMI_API_KEY;
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(KimiService.listModels()).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});