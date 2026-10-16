/**
 * Testes de GET /api/health/storage.
 *
 * O payload e publico: nao pode sair daqui chave, bucket, ref ou string de
 * conexao. E STORAGE_BACKEND ausente/invalido nao pode virar 500, porque o
 * monitoramento precisa enxergar o codigo de configuracao.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockStorageBackend = vi.fn();
vi.mock("@/lib/knowledge/storage.service", () => ({
  storageBackend: () => mockStorageBackend() as string,
}));

vi.mock("@/lib/knowledge/storage/backend", () => {
  class StorageBackendError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return { StorageBackendError };
});

const mockIsR2Configured = vi.fn();
vi.mock("@/lib/knowledge/storage/r2-storage.service", () => ({
  isR2Configured: () => mockIsR2Configured() as boolean,
}));

const mockEmbeddingConfigured = vi.fn();
vi.mock("@/lib/knowledge/embedding/client", () => ({
  embeddingClient: { isConfigured: () => mockEmbeddingConfigured() as boolean },
}));

import { StorageBackendError } from "@/lib/knowledge/storage/backend";
import * as healthRoute from "@/app/api/health/route";
import * as storageHealthRoute from "@/app/api/health/storage/route";
import { GET } from "@/app/api/health/storage/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageBackend.mockReturnValue("supabase");
  mockIsR2Configured.mockReturnValue(false);
  mockEmbeddingConfigured.mockReturnValue(false);
  delete process.env.DEEPSEEK_API_KEY;
});

afterEach(() => {
  delete process.env.DEEPSEEK_API_KEY;
});

describe("GET /api/health/storage", () => {
  it("os dois handlers de health sao dinamicos", () => {
    expect(storageHealthRoute.dynamic).toBe("force-dynamic");
    expect(healthRoute.dynamic).toBe("force-dynamic");
  });

  it("reporta o backend ativo sem tocar em credenciais", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.storage.backend).toBe("supabase");
    expect(body.storage.backendError).toBeNull();
    expect(body.storage.r2Configured).toBe(false);
    expect(body.ai.embeddingConfigured).toBe(false);
  });

  it("STORAGE_BACKEND invalido devolve 200 com o codigo, nunca 500", async () => {
    mockStorageBackend.mockImplementation(() => {
      throw new StorageBackendError("STORAGE_BACKEND_INVALID", "valor invalido");
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.storage.backend).toBeNull();
    expect(body.storage.backendError).toBe("STORAGE_BACKEND_INVALID");
  });

  it("nao vaza o valor das chaves no payload", async () => {
    process.env.DEEPSEEK_API_KEY = "sk-fake-token-998877665544";
    mockEmbeddingConfigured.mockReturnValue(true);
    const res = await GET();
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("sk-fake-token-998877665544");
    expect(text).not.toContain("postgresql://");
    expect(JSON.parse(text).ai.deepseekConfigured).toBe(true);
  });

  it("variavel de ambiente com espaco conta como nao configurada", async () => {
    process.env.DEEPSEEK_API_KEY = "   ";
    const res = await GET();
    const body = await res.json();
    expect(body.ai.deepseekConfigured).toBe(false);
  });
});
