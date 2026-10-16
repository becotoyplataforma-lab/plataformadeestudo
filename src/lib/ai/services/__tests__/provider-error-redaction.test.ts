/**
 * FASE B2 - O que o provedor de IA lanca nunca chega ao cliente com credencial.
 *
 * "flash" e o AIModel que o provedor resolve para "deepseek-chat"
 * (MODEL_NAMES.flash, src/lib/ai/types.ts): a chamada ao DeepSeek e a mesma.
 * As rotas de geracao devolvem error.message ao usuario (questions/generate,
 * admin/lessons/generate, admin/questions/generate). Portanto a sanitizacao precisa
 * acontecer na origem, no ProviderError, e nao em cada rota.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const chatCompletion = vi.fn();
const loggerCalls: unknown[][] = [];

vi.mock("@/lib/ai/deepseek", () => ({
  chatCompletion: (...args: unknown[]) => chatCompletion(...args),
}));

vi.mock("@/lib/ai/kimi", () => ({
  KimiService: { complete: vi.fn() },
}));

vi.mock("@/lib/observability", async (importOriginal) => {
  const real = await importOriginal< typeof import("@/lib/observability") >();
  return {
    ...real,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: (...args: unknown[]) => {
        loggerCalls.push(args);
      },
    },
  };
});

import { DeepSeekProvider, ProviderError } from "../deepseek-provider.service";

const SECRET = "chave-de-teste-9f3a2b";
const REF = "abcdefghijklmnopqrstuvwxyz".slice(0, 20);

beforeEach(() => {
  chatCompletion.mockReset();
  loggerCalls.length = 0;
});

describe("ProviderError", () => {
  it("redige a mensagem que a rota devolve ao cliente", async () => {
    chatCompletion.mockRejectedValue(
      new Error("401 unauthorized: api_key=" + SECRET + " em " + REF + ".supabase.co")
    );

    await expect(
      DeepSeekProvider.complete({ model: "flash", messages: [] })
    ).rejects.toBeInstanceOf(ProviderError);

    let caught: unknown;
    try {
      await DeepSeekProvider.complete({ model: "flash", messages: [] });
    } catch (error) {
      caught = error;
    }
    const typed = caught as ProviderError;
    expect(typed.code).toBe("PROVIDER_FAILED");
    expect(typed.message).not.toContain(SECRET);
    expect(typed.message).not.toContain(REF);
    expect(typed.message).toContain("401 unauthorized");
  });

  it("grava no log apenas a versao redigida", async () => {
    chatCompletion.mockRejectedValue(new Error("timeout ao chamar provedor; api_key=" + SECRET));
    await expect(
      DeepSeekProvider.complete({ model: "flash", messages: [] })
    ).rejects.toBeInstanceOf(ProviderError);

    expect(loggerCalls.length).toBeGreaterThan(0);
    expect(JSON.stringify(loggerCalls)).not.toContain(SECRET);
  });
});
