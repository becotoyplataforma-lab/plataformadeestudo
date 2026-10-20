/**
 * Testes do DocumentService.remover (Fase 2).
 *
 * Regra central: apagar um documento TEM de apagar os bytes no storage, e um
 * documento de outro usuário é 404 sem tocar em nada (.ai/08-SECURITY-STANDARDS).
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockFindById = vi.fn();
const mockSoftDelete = vi.fn();
const mockDeleteSubjects = vi.fn();
const mockDeleteTopics = vi.fn();
const mockDeleteTags = vi.fn();
const mockSoftDeleteChunks = vi.fn();

vi.mock("../../repositories/document.repository", () => ({
  DocumentRepository: {
    findById: (...args: unknown[]) => mockFindById(...args),
    softDelete: (...args: unknown[]) => mockSoftDelete(...args),
  },
}));

vi.mock("../../repositories/junction.repository", () => ({
  DocumentSubjectRepository: { deleteByDocument: (...args: unknown[]) => mockDeleteSubjects(...args) },
  DocumentTopicRepository: { deleteByDocument: (...args: unknown[]) => mockDeleteTopics(...args) },
  DocumentTagRepository: { deleteByDocument: (...args: unknown[]) => mockDeleteTags(...args) },
}));

vi.mock("../../repositories/chunk.repository", () => ({
  DocumentChunkRepository: {
    softDeleteByDocument: (...args: unknown[]) => mockSoftDeleteChunks(...args),
  },
}));

import { setStorageForTests } from "@/lib/storage";
import { LocalStorageAdapter } from "@/lib/storage/local.adapter";
import { StorageError, type StorageAdapter } from "@/lib/storage/types";
import { DocumentService } from "../document.service";

const RAIZ_TESTE = mkdtempSync(path.join(tmpdir(), "concursoai-doc-del-"));
const CHAVE = "user-1/doc-1/aula-01.pdf";

function discoDaChave(chave: string): string {
  return path.join(RAIZ_TESTE, ...chave.split("/"));
}

/** Adapter cujo `delete` falha (simula R2 fora do ar). */
function adaptadorComDeleteQueFalha(): StorageAdapter {
  return {
    driver: "local",
    upload: vi.fn(),
    getStream: vi.fn(),
    getUrl: vi.fn(),
    delete: vi.fn().mockRejectedValue(new StorageError("READ_FAILED", "storage indisponível")),
    exists: vi.fn().mockResolvedValue(true),
  };
}

async function semearBytes(): Promise<void> {
  // Tipado pelo contrato (StorageAdapter.upload aceita contentType; o driver
  // local deriva o Content-Type da extensão da chave).
  const adaptador: StorageAdapter = new LocalStorageAdapter(RAIZ_TESTE);
  await adaptador.upload(CHAVE, new Uint8Array([1, 2, 3]), "application/pdf");
}

describe("DocumentService.remover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStorageForTests(new LocalStorageAdapter(RAIZ_TESTE));
    mockSoftDelete.mockResolvedValue({ id: "doc-1" });
    mockDeleteSubjects.mockResolvedValue(undefined);
    mockDeleteTopics.mockResolvedValue(undefined);
    mockDeleteTags.mockResolvedValue(undefined);
    mockSoftDeleteChunks.mockResolvedValue(undefined);
  });

  afterAll(() => {
    setStorageForTests(null);
    rmSync(RAIZ_TESTE, { recursive: true, force: true });
  });

  it("remove linha, vínculos, chunks e os bytes do storage", async () => {
    await semearBytes();
    expect(existsSync(discoDaChave(CHAVE))).toBe(true);

    mockFindById.mockResolvedValue({ id: "doc-1", userId: "user-1", storagePath: CHAVE });

    await expect(DocumentService.remover({ userId: "user-1", documentId: "doc-1" })).resolves.toEqual({
      status: "removido",
      bytesRemovidos: true,
    });

    expect(mockSoftDelete).toHaveBeenCalledWith("doc-1");
    expect(mockDeleteSubjects).toHaveBeenCalledWith("doc-1");
    expect(mockDeleteTopics).toHaveBeenCalledWith("doc-1");
    expect(mockDeleteTags).toHaveBeenCalledWith("doc-1");
    expect(mockSoftDeleteChunks).toHaveBeenCalledWith("doc-1");
    expect(existsSync(discoDaChave(CHAVE))).toBe(false);
  });

  it("não apaga nada se o documento pertence a outro usuário", async () => {
    await semearBytes();
    mockFindById.mockResolvedValue({ id: "doc-1", userId: "OUTRO-USUARIO", storagePath: CHAVE });

    await expect(
      DocumentService.remover({ userId: "user-1", documentId: "doc-1" })
    ).resolves.toEqual({ status: "nao_encontrado" });

    expect(mockSoftDelete).not.toHaveBeenCalled();
    expect(existsSync(discoDaChave(CHAVE))).toBe(true);
  });

  it("devolve nao_encontrado quando a linha não existe", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(
      DocumentService.remover({ userId: "user-1", documentId: "doc-9" })
    ).resolves.toEqual({ status: "nao_encontrado" });

    expect(mockSoftDelete).not.toHaveBeenCalled();
  });

  it("mantém o registro removido e sinaliza quando o storage falha", async () => {
    await semearBytes();
    mockFindById.mockResolvedValue({ id: "doc-1", userId: "user-1", storagePath: CHAVE });
    setStorageForTests(adaptadorComDeleteQueFalha());
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      DocumentService.remover({ userId: "user-1", documentId: "doc-1" })
    ).resolves.toEqual({ status: "removido", bytesRemovidos: false });

    expect(mockSoftDelete).toHaveBeenCalledWith("doc-1");
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });
});
