/**
 * Testes do DocumentStorageService — backend EXPLÍCITO (STORAGE_BACKEND),
 * sem fallback silencioso R2↔Supabase.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mocks — Supabase admin client (storage) e R2StorageService (commands).
// vi.hoisted: garante que as variáveis existam antes do hoist dos vi.mock.
const mocks = vi.hoisted(() => {
  const supabaseUpload = vi.fn();
  const supabaseDownload = vi.fn();
  const supabaseRemove = vi.fn();
  const supabaseEnsure = vi.fn();
  const supabaseGetBucket = vi.fn();
  const r2Upload = vi.fn();
  const r2Download = vi.fn();
  const r2Remove = vi.fn();
  const r2Ensure = vi.fn();
  return {
    supabaseUpload,
    supabaseDownload,
    supabaseRemove,
    supabaseEnsure,
    supabaseGetBucket,
    r2Upload,
    r2Download,
    r2Remove,
    r2Ensure,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      getBucket: mocks.supabaseGetBucket,
      createBucket: mocks.supabaseEnsure,
      from: () => ({
        upload: mocks.supabaseUpload,
        download: mocks.supabaseDownload,
        remove: mocks.supabaseRemove,
      }),
    },
  }),
}));

vi.mock("@/lib/knowledge/storage/r2-storage.service", () => ({
  R2StorageService: {
    upload: mocks.r2Upload,
    download: mocks.r2Download,
    remove: mocks.r2Remove,
    ensureBucket: mocks.r2Ensure,
  },
  isR2Configured: () => Boolean(process.env.R2_ACCOUNT_ID),
}));

import { DocumentStorageService } from "@/lib/knowledge/storage.service";
import { resolveStorageBackend, StorageBackendError } from "@/lib/knowledge/storage/backend";

const envBackup = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STORAGE_BACKEND;
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.R2_ACCESS_KEY_ID;
  delete process.env.R2_SECRET_ACCESS_KEY;
});

afterEach(() => {
  process.env = { ...envBackup };
});

const uploadInput = {
  userId: "u-1",
  documentId: "d-1",
  fileName: "apostila.pdf",
  buffer: Buffer.from("x"),
  mimeType: "application/pdf",
};

describe("resolveStorageBackend (backend explícito)", () => {
  it("retorna 'supabase' por default em dev/teste (sem STORAGE_BACKEND)", () => {
    expect(resolveStorageBackend({ NODE_ENV: "test" })).toBe("supabase");
  });

  it("retorna 'r2' quando STORAGE_BACKEND=r2", () => {
    expect(resolveStorageBackend({ STORAGE_BACKEND: "r2" })).toBe("r2");
  });

  it("FALHA (fail-fast) em produção sem STORAGE_BACKEND", () => {
    expect(() => resolveStorageBackend({ NODE_ENV: "production" })).toThrow(StorageBackendError);
    expect(() => resolveStorageBackend({ NODE_ENV: "production" })).toThrow(/STORAGE_BACKEND/);
  });

  it("rejeita valor inválido", () => {
    expect(() => resolveStorageBackend({ STORAGE_BACKEND: "s3" })).toThrow(StorageBackendError);
  });
});

describe("DocumentStorageService — backend explícito", () => {
  it("STORAGE_BACKEND=supabase → upload() usa Supabase (nunca R2)", async () => {
    process.env.STORAGE_BACKEND = "supabase";
    mocks.supabaseGetBucket.mockResolvedValue({ data: { id: "documents" }, error: null });
    mocks.supabaseUpload.mockResolvedValue({ error: null });
    await DocumentStorageService.upload(uploadInput);
    expect(mocks.supabaseUpload).toHaveBeenCalledTimes(1);
    expect(mocks.r2Upload).not.toHaveBeenCalled();
  });

  it("STORAGE_BACKEND=r2 (configurado) → upload() usa R2 (nunca Supabase)", async () => {
    process.env.STORAGE_BACKEND = "r2";
    process.env.R2_ACCOUNT_ID = "a";
    process.env.R2_ACCESS_KEY_ID = "k";
    process.env.R2_SECRET_ACCESS_KEY = "s";
    mocks.r2Upload.mockResolvedValue("u-1/d-1/apostila.pdf");
    const path = await DocumentStorageService.upload(uploadInput);
    expect(mocks.r2Upload).toHaveBeenCalledTimes(1);
    expect(mocks.supabaseUpload).not.toHaveBeenCalled();
    expect(path).toBe("u-1/d-1/apostila.pdf");
  });

  it("STORAGE_BACKEND=r2 mas R2 NÃO configurado → erro explícito (sem fallback)", async () => {
    process.env.STORAGE_BACKEND = "r2";
    // Sem R2_ACCOUNT_ID etc.
    await expect(DocumentStorageService.upload(uploadInput)).rejects.toMatchObject({
      code: "R2_NOT_CONFIGURED",
    });
    expect(mocks.supabaseUpload).not.toHaveBeenCalled();
    expect(mocks.r2Upload).not.toHaveBeenCalled();
  });

  it("download() usa backend do DOCUMENTO (r2) mesmo com STORAGE_BACKEND=supabase", async () => {
    process.env.STORAGE_BACKEND = "supabase";
    process.env.R2_ACCOUNT_ID = "a";
    process.env.R2_ACCESS_KEY_ID = "k";
    process.env.R2_SECRET_ACCESS_KEY = "s";
    mocks.r2Download.mockResolvedValue(Buffer.from("r2"));
    const buf = await DocumentStorageService.download("u/d/f.pdf", "r2");
    expect(buf).toEqual(Buffer.from("r2"));
    expect(mocks.r2Download).toHaveBeenCalledWith("u/d/f.pdf");
    expect(mocks.supabaseDownload).not.toHaveBeenCalled();
  });

  it("download() sem backend explícito usa o backend global", async () => {
    process.env.STORAGE_BACKEND = "supabase";
    mocks.supabaseDownload.mockResolvedValue({
      data: new Blob([Buffer.from("supabase")]),
      error: null,
    });
    const buf = await DocumentStorageService.download("u/d/f.pdf");
    expect(buf).toEqual(Buffer.from("supabase"));
    expect(mocks.supabaseDownload).toHaveBeenCalledWith("u/d/f.pdf");
    expect(mocks.r2Download).not.toHaveBeenCalled();
  });

  it("remove() usa backend do DOCUMENTO; sem ele, backend global", async () => {
    process.env.STORAGE_BACKEND = "supabase";
    mocks.supabaseRemove.mockResolvedValue({ error: null });
    await DocumentStorageService.remove("u/d/f.pdf", "supabase");
    expect(mocks.supabaseRemove).toHaveBeenCalledTimes(1);
    expect(mocks.r2Remove).not.toHaveBeenCalled();
  });
});

describe("DocumentStorageService — ensureBucket", () => {
  it("supabase → garante bucket no Supabase", async () => {
    process.env.STORAGE_BACKEND = "supabase";
    mocks.supabaseGetBucket.mockResolvedValue({ data: { id: "documents" }, error: null });
    await DocumentStorageService.ensureBucket();
    expect(mocks.supabaseGetBucket).toHaveBeenCalledWith("documents");
  });

  it("r2 configurado → garante bucket no R2", async () => {
    process.env.STORAGE_BACKEND = "r2";
    process.env.R2_ACCOUNT_ID = "a";
    process.env.R2_ACCESS_KEY_ID = "k";
    process.env.R2_SECRET_ACCESS_KEY = "s";
    await DocumentStorageService.ensureBucket();
    expect(mocks.r2Ensure).toHaveBeenCalled();
  });
});
