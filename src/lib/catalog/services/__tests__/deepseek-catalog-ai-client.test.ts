/**
 * Adapter DeepSeek do catalogo (FASE 4B).
 *
 * O que importa aqui e a costura, nao o provedor: o adapter implementa exatamente a
 * porta `CatalogAiClient` da FASE 4, reusa o `DeepSeekProvider` existente (sem segunda
 * configuracao de IA), respeita o timeout e nunca deixa uma falha de modelo virar
 * decisao de catalogo. `DeepSeekProvider` e mockado: nenhum teste desta arquivo faz
 * rede, e o fetch global esta envenenado para provar isso.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const completeMock = vi.fn();
vi.mock("@/lib/ai/services/deepseek-provider.service", () => ({
  DeepSeekProvider: { complete: (req: unknown) => completeMock(req) },
}));

import { MODEL_NAMES } from "@/lib/ai/types";
import {
  CatalogAiClientError,
  DeepSeekCatalogAiClient,
  createDeepSeekCatalogAiClient,
  isDeepSeekCatalogConfigured,
} from "../deepseek-catalog-ai-client";
import { requestCatalogAiProposals } from "../ai-proposal.service";
import { normalizeTopics } from "../topic-normalizer.service";
import { CATALOG_SNAPSHOT_KIND, loadCatalogSnapshot } from "../catalog-snapshot.service";
import type { CatalogAiPrompt } from "../ai-proposal.service";
import type { CatalogNormalizedTopic } from "../../types/catalog-ingestion";

const PROMPT: CatalogAiPrompt = {
  system: "anotador",
  user: "candidatos",
  maxTokens: 1234,
};

function topics(): CatalogNormalizedTopic[] {
  return normalizeTopics([
    {
      candidateId: "CAND-1",
      rawName: "Pontua\u00E7\u00E3o",
      origin: "PUBLISHED_LABEL",
      derivationRule: "teste",
      positionTitle: "Soldado",
      disciplineName: "Portugu\u00EAs",
      start: 0,
      end: 9,
      excerpt: "Pontua\u00E7\u00E3o: uso.",
    },
  ]);
}

function view() {
  return loadCatalogSnapshot({
    kind: CATALOG_SNAPSHOT_KIND,
    schema_version: 1,
    generated_at: "2026-10-03T00:00:00.000Z",
    checksum_sha256: "c".repeat(64),
    seed_compatible: false,
    destructive: false,
    data: {
      knowledge_subjects: [
        { id: "sub-1", name: "Portugu\u00EAs", slug: "portugues", status: "active", deleted_at: null },
      ],
      knowledge_topics: [
        { id: "top-1", subject_id: "sub-1", parent_topic_id: null, name: "Pontua\u00E7\u00E3o", slug: "pontuacao", status: "active", deleted_at: null },
      ],
    },
    analysis: { knowledge_topics_per_subject: [] },
  });
}

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  completeMock.mockReset();
  fetchSpy = vi.fn(async () => {
    throw new Error("rede nao permitida nesta fase");
  });
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubEnv("DEEPSEEK_API_KEY", "chave-de-teste");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("porta do dominio", () => {
  it("implementa CatalogAiClient com o modelo do provedor existente", () => {
    const client = new DeepSeekCatalogAiClient();
    expect(client.provider).toBe("deepseek");
    expect(client.model).toBe(MODEL_NAMES.flash);
    expect(isDeepSeekCatalogConfigured()).toBe(true);
  });

  it("reusa DeepSeekProvider com system+user, temperatura zero e maxTokens do prompt", async () => {
    completeMock.mockResolvedValue({ content: "{\"proposals\":[]}", model: "flash", tokensIn: 10, tokensOut: 2 });
    const client = new DeepSeekCatalogAiClient();
    expect(await client.complete(PROMPT)).toBe("{\"proposals\":[]}");
    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(completeMock.mock.calls[0]?.[0]).toEqual({
      model: "flash",
      messages: [
        { role: "system", content: "anotador" },
        { role: "user", content: "candidatos" },
      ],
      temperature: 0,
      maxTokens: 1234,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fabrica devolve cliente so quando ha chave", () => {
    expect(createDeepSeekCatalogAiClient()).not.toBeNull();
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    expect(createDeepSeekCatalogAiClient()).toBeNull();
    expect(isDeepSeekCatalogConfigured()).toBe(false);
  });
});

describe("falhas viram codigo do dominio, nunca decisao", () => {
  it("sem chave nao chama o provedor", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const client = new DeepSeekCatalogAiClient();
    await expect(client.complete(PROMPT)).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
    expect(completeMock).not.toHaveBeenCalled();
  });

  it("resposta lenta produce AI_TIMEOUT", async () => {
    completeMock.mockImplementation(() => new Promise(() => undefined));
    const client = new DeepSeekCatalogAiClient({ timeoutMs: 10 });
    await expect(client.complete(PROMPT)).rejects.toBeInstanceOf(CatalogAiClientError);
    await expect(client.complete(PROMPT)).rejects.toMatchObject({ code: "AI_TIMEOUT" });
  });

  it("erro do provedor produce AI_PROVIDER_FAILED com mensagem fixa", async () => {
    completeMock.mockRejectedValue(new Error("HTTP 500 com body interno do provedor"));
    const client = new DeepSeekCatalogAiClient();
    const error = await client.complete(PROMPT).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(CatalogAiClientError);
    expect((error as CatalogAiClientError).code).toBe("AI_PROVIDER_FAILED");
    expect((error as Error).message).not.toContain("HTTP 500");
  });

  it("resposta vazia produce AI_EMPTY_RESPONSE", async () => {
    completeMock.mockResolvedValue({ content: "   ", model: "flash", tokensIn: 1, tokensOut: 0 });
    const client = new DeepSeekCatalogAiClient();
    await expect(client.complete(PROMPT)).rejects.toMatchObject({ code: "AI_EMPTY_RESPONSE" });
  });
});

describe("o adapter atravessa o validador da FASE 4", () => {
  async function section(raw: string | (() => Promise<string>)) {
    completeMock.mockImplementation(async () => ({
      content: typeof raw === "string" ? raw : await raw(),
      model: "flash",
      tokensIn: 5,
      tokensOut: 5,
    }));
    return requestCatalogAiProposals({
      candidates: topics(),
      view: view(),
      request: { enabled: true, provider: "deepseek", maxCandidates: 10 },
      client: new DeepSeekCatalogAiClient(),
    });
  }

  it("proposta valida entra como anotacao com provider e model reais", async () => {
    const result = await section(JSON.stringify({ proposals: [{ candidate_id: "CAND-1", suggested_canonical_topic_id: "top-1", justification: "Mesmo topico publicado.", confidence: 0.9 }] }));
    expect(result.enabled).toBe(true);
    expect(result.provider).toBe("deepseek");
    expect(result.model).toBe(MODEL_NAMES.flash);
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.candidateId).toBe("CAND-1");
    expect(result.rejections).toEqual([]);
  });

  it("JSON inválido e rejeitado sem quebrar a auditoria", async () => {
    const result = await section("<html>502</html>");
    expect(result.rejections.map((item) => item.code)).toEqual(["AI_SCHEMA_INVALID"]);
    expect(result.proposals).toEqual([]);
  });

  it("fora do schema e rejeitado com o campo ofensor", async () => {
    const result = await section(JSON.stringify({ proposals: [{ candidate_id: "CAND-1", justification: "Nome sem correspondencia canonica.", confidence: 40 }] }));
    expect(result.rejections.some((item) => item.code === "AI_SCHEMA_INVALID")).toBe(true);
    expect(result.rejections[0]?.offendingField).toBe("proposals.0.confidence");
  });

  it("overreach descarta tudo e registra so o nome do campo", async () => {
    const result = await section(JSON.stringify({ proposals: [{ candidate_id: "CAND-1", justification: "ok", confidence: 0.5 }], classification: "REUSO_CANONICO" }));
    expect(result.proposals).toEqual([]);
    expect(result.rejections.map((item) => item.offendingField)).toEqual(["classification"]);
    expect(result.rejections.every((item) => item.code === "AI_OVERREACH")).toBe(true);
  });

  it("timeout do adapter vira AI_PROVIDER_FAILED na secao", async () => {
    completeMock.mockImplementation(() => new Promise(() => undefined));
    const result = await requestCatalogAiProposals({
      candidates: topics(),
      view: view(),
      request: { enabled: true, provider: "deepseek" },
      client: new DeepSeekCatalogAiClient({ timeoutMs: 10 }),
    });
    expect(result.rejections.map((item) => item.code)).toEqual(["AI_PROVIDER_FAILED"]);
    expect(result.proposals).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});