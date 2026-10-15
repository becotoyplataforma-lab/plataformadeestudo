/**
 * Teste aditivo do POST /api/admin/apostilas/batch.
 *
 * O arquivo de teste antigo permanece intocado. Aqui se cobre apenas o campo
 * processing acrescentado por linha. Sem ele, um lote em que o documento
 * nasceu mas a conversao falhou aparece como sucesso puro, e o operador so
 * descobre o material quebrado dias depois.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetSession = vi.fn();
vi.mock("@/lib/administration/session", () => ({
  getAdminSession: (...a: unknown[]) => mockGetSession(...a),
}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/administration/services/admin-guard.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/administration/services/admin-guard.service")
  >();
  return {
    ...actual,
    AdminGuardService: {
      ...actual.AdminGuardService,
      requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
    },
  };
});

const mockIngest = vi.fn();
vi.mock("@/lib/knowledge/services/ingestion.service", () => ({
  IngestionService: { ingest: (...a: unknown[]) => mockIngest(...a) },
  IngestionError: class IngestionError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

const mockUpload = vi.fn();
vi.mock("@/lib/knowledge/storage.service", () => ({
  DocumentStorageService: { upload: (...a: unknown[]) => mockUpload(...a) },
}));

// A fabrica devolve a propria classe de erro que o roteador importa, entao o
// instanceof do route funciona sem carregar pipeline real, env e banco.
const mockProcess = vi.fn();
vi.mock("@/lib/knowledge/services/document-pipeline.service", () => ({
  DocumentPipelineService: {
    processDocument: (...a: unknown[]) => mockProcess(...a),
  },
  PipelineError: class PipelineError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "PipelineError";
      this.code = code;
    }
  },
}));

const mockFindById = vi.fn();
const mockUpdateMetadata = vi.fn();
vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {
    findById: (...a: unknown[]) => mockFindById(...a),
    updateMetadata: (...a: unknown[]) => mockUpdateMetadata(...a),
    updateAssociations: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@/lib/knowledge/repositories/junction.repository", () => ({
  DocumentSubjectRepository: { upsert: vi.fn().mockResolvedValue(null) },
}));

import { POST, safeProcessingMessage } from "@/app/api/admin/apostilas/batch/route";
import { PipelineError } from "@/lib/knowledge/services/document-pipeline.service";

const SUBJECT_ID = "11111111-1111-4111-8111-111111111111";

function batchRequest(names: string[]) {
  const form = new FormData();
  form.append("subject_id", SUBJECT_ID);
  for (const name of names) {
    form.append(
      "files",
      new File(["conteudo artificial de teste"], name, { type: "application/pdf" })
    );
  }
  return new NextRequest("http://localhost/api/admin/apostilas/batch", {
    method: "POST",
    body: form,
  });
}

function pipelineOk(status: string) {
  return {
    documentId: "doc-1",
    status,
    chunkCount: 4,
    embeddingCount: status === "indexed" ? 4 : 0,
    pageCount: 2,
    embeddingConfigured: status === "indexed",
  };
}

describe("lote com visibilidade da conversao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ userId: "admin-1" });
    mockRequireAdmin.mockResolvedValue(true);
    mockIngest.mockResolvedValue({
      documentId: "doc-1",
      storagePath: "admin-1/doc-1/aula-01.pdf",
      mimeType: "application/pdf",
      status: "pending",
    });
    mockUpload.mockResolvedValue({});
    mockUpdateMetadata.mockResolvedValue({});
    mockProcess.mockResolvedValue(pipelineOk("chunked"));
    mockFindById.mockResolvedValue({ status: "chunked" });
  });

  it("material convertido sem embedding aparece como aguardando indexacao", async () => {
    const res = await POST(batchRequest(["aula-01.pdf"]));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.results[0].processing.status).toBe("chunked");
    expect(body.awaitingIndexingCount).toBe(1);
    expect(body.processingFailedCount).toBe(0);
  });

  it("falha de conversao vem com codigo de dominio na linha do arquivo", async () => {
    mockProcess.mockRejectedValue(new PipelineError("EMPTY_TEXT", "nada extraido"));
    mockFindById.mockResolvedValue({ status: "failed" });
    const res = await POST(batchRequest(["aula-01.pdf"]));
    const body = await res.json();
    expect(res.status).toBe(207);
    expect(body.results[0].processing.code).toBe("EMPTY_TEXT");
    expect(body.results[0].processing.status).toBe("failed");
    expect(body.processingFailedCount).toBe(1);
  });

  it("texto cru do driver nao chega ao cliente", async () => {
    mockProcess.mockRejectedValue(
      new PipelineError(
        "PROCESSING_FAILED",
        "putObject failed bucket=private-documents token=abc123"
      )
    );
    mockFindById.mockResolvedValue({ status: "failed" });
    const res = await POST(batchRequest(["aula-01.pdf"]));
    const text = JSON.stringify(await res.json());
    expect(text).toContain("PROCESSING_FAILED");
    expect(text).not.toContain("private-documents");
    expect(text).not.toContain("abc123");
  });

  it("um arquivo quebrado nao impede o resto do lote", async () => {
    mockProcess
      .mockRejectedValueOnce(new PipelineError("EMPTY_TEXT", "vazio"))
      .mockResolvedValueOnce(pipelineOk("indexed"));
    mockFindById.mockResolvedValue({ status: "indexed" });
    const res = await POST(batchRequest(["aula-01.pdf", "aula-02.pdf"]));
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.results[0].processing.code).toBe("EMPTY_TEXT");
    expect(body.results[1].processing.status).toBe("indexed");
    expect(mockIngest).toHaveBeenCalledTimes(2);
  });

  it("mensagem de fallback nunca devolve o texto original", () => {
    expect(safeProcessingMessage("NO_STORAGE")).toContain("arquivo fisico");
    expect(safeProcessingMessage("CODIGO_DESCONHECIDO")).toBe(
      "Falha ao processar o arquivo."
    );
  });
});
