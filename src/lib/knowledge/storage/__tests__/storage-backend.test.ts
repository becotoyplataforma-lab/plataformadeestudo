/**
 * Testes unitários — resolução explícito do backend de storage.
 *
 * O ponto que estes testes fecham é o guard do backend `local`: o adaptador de
 * filesystem serve desenvolvimento e ingestão offline. Deixá-lo passar em
 * produção significaria servir apostila a partir do disco efémero do deploy —
 * ficheiro que desaparece no próximo cold start.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveStorageBackend,
  storageBackend,
  StorageBackendError,
} from "@/lib/knowledge/storage/backend";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("resolveStorageBackend — backend local", () => {
  it("aceita STORAGE_BACKEND=local fora de produção", () => {
    expect(
      resolveStorageBackend({ STORAGE_BACKEND: "local", NODE_ENV: "test" })
    ).toBe("local");
  });

  it("aceita a forma com espaços e maiúsculas", () => {
    expect(
      resolveStorageBackend({ STORAGE_BACKEND: "  LOCAL ", NODE_ENV: "development" })
    ).toBe("local");
  });

  it("recusa STORAGE_BACKEND=local em produção com LOCAL_BACKEND_FORBIDDEN", () => {
    expect(() =>
      resolveStorageBackend({ STORAGE_BACKEND: "local", NODE_ENV: "production" })
    ).toThrowError(StorageBackendError);

    try {
      resolveStorageBackend({ STORAGE_BACKEND: "local", NODE_ENV: "production" });
      expect.unreachable("o guard de produção deveria ter lançado");
    } catch (error) {
      expect((error as StorageBackendError).code).toBe("LOCAL_BACKEND_FORBIDDEN");
    }
  });

  it("mantém o fail-fast sem STORAGE_BACKEND em produção", () => {
    try {
      resolveStorageBackend({ STORAGE_BACKEND: "", NODE_ENV: "production" });
      expect.unreachable("fail-fast esperado");
    } catch (error) {
      expect((error as StorageBackendError).code).toBe("STORAGE_BACKEND_REQUIRED");
    }
  });

  it("erro de valor inválido menciona os três backends válidos", () => {
    try {
      resolveStorageBackend({ STORAGE_BACKEND: "s3", NODE_ENV: "test" });
      expect.unreachable("valor inválido deveria lançar");
    } catch (error) {
      const message = (error as StorageBackendError).message;
      expect(message).toContain('"r2"');
      expect(message).toContain('"supabase"');
      expect(message).toContain('"local"');
    }
  });

  it("default em teste continua supabase (suíte existente não pode mudar de storage)", () => {
    expect(resolveStorageBackend({ STORAGE_BACKEND: "", NODE_ENV: "test" })).toBe("supabase");
  });

  it("storageBackend() lê process.env sem argumentos", () => {
    process.env.STORAGE_BACKEND = "local";
    // NODE_ENV é read-only na tipologia do Node; só o stub do vitest o altera.
    vi.stubEnv("NODE_ENV", "test");
    expect(storageBackend()).toBe("local");
  });
});
