/**
 * Testes do cliente do provider (src/lib/ai/deepseek.ts) — roteamento por modelo.
 * Valida que "flash"/"pro" usam o endpoint/chave do DeepSeek e que "muse"
 * usa o endpoint/chave do provedor Muse/Meta (MUSE_*), com erro claro quando
 * o endpoint não está configurado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const OK_BODY = {
  id: "1",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "ok" },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
};

describe("deepseek.ts — roteamento por modelo (DeepSeek ↔ Muse)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("flash → endpoint/chave do DeepSeek", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-deepseek-teste");
    vi.stubEnv("DEEPSEEK_BASE_URL", "https://api.deepseek.com");
    vi.mocked(fetch).mockResolvedValue(jsonResponse(OK_BODY));

    const ds = await import("@/lib/ai/deepseek");
    await ds.chatCompletion({
      model: "flash",
      messages: [{ role: "user", content: "oi" }],
    });

    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("https://api.deepseek.com/chat/completions");
    expect((opts!.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk-deepseek-teste"
    );
  });

  it("muse → endpoint/chave/modelo do provedor Muse/Meta", async () => {
    vi.stubEnv("MUSE_API_KEY", "LLM_teste");
    vi.stubEnv("MUSE_BASE_URL", "https://api.muse.example.com/v1");
    vi.stubEnv("MUSE_MODEL", "muse-1.2");
    vi.mocked(fetch).mockResolvedValue(jsonResponse(OK_BODY));

    const ds = await import("@/lib/ai/deepseek");
    await ds.chatCompletion({
      model: "muse",
      messages: [{ role: "user", content: "oi" }],
    });

    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("https://api.muse.example.com/v1/chat/completions");
    expect((opts!.headers as Record<string, string>).Authorization).toBe(
      "Bearer LLM_teste"
    );
    const body = JSON.parse(String(opts!.body));
    expect(body.model).toBe("muse-1.2");
  });

  it("muse sem MUSE_BASE_URL → erro claro", async () => {
    vi.stubEnv("MUSE_API_KEY", "LLM_teste");
    // MUSE_BASE_URL intencionalmente ausente
    const ds = await import("@/lib/ai/deepseek");
    await expect(
      ds.chatCompletion({ model: "muse", messages: [] })
    ).rejects.toThrow(/MUSE_BASE_URL/);
  });
});
