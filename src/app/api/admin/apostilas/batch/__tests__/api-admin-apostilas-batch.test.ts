/**
 * Testes de POST /api/admin/apostilas/batch.
 *
 * Mesmos contratos do upload individual, agora em lote: autenticacao,
 * autorizacao, validacao de entrada, selecao e capacidade do MCP, rejeicao
 * por arquivo sem interromper o restante do lote, carimbo de metadata
 * (mcp_provider_id, mcp_version, processing_version) e ausencia de vazamento
 * de erro interno. IngestionService, storage, pipeline e repositories sao
 * mockados; o plano do MCP usa os provedores reais do registry.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetSession = vi.fn();
vi.mock("@/lib/administration/session", () => ({
  getAdminSession: (...args: unknown[]) => mockGetSession(...args),
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

const mockProcess = vi.fn();
vi.mock("@/lib/knowledge/services/document-pipeline.service", () => ({
  DocumentPipelineService: {
    processDocument: (...a: unknown[]) => mockProcess(...a),
  },
}));

const mockUpdateMetadata = vi.fn();
const mockUpdateAssociations = vi.fn();
const mockFindById = vi.fn();
vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {
    updateMetadata: (...a: unknown[]) => mockUpdateMetadata(...a),
    updateAssociations: (...a: unknown[]) => mockUpdateAssociations(...a),
    findById: (...a: unknown[]) => mockFindById(...a),
  },
}));

vi.mock("@/lib/knowledge/security/document-scope", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/knowledge/security/document-scope")
  >();
  // O validador real consulta positions/editais. Aqui ele apenas ecoa os ids:
  // a validacao tem teste proprio, e este arquivo cobre a orquestracao do lote.
  return {
    ...actual,
    validateDocumentScope: async (input: {
      positionId?: string | null;
      editalId?: string | null;
    }) => ({
      positionId: input.positionId ?? null,
      editalId: input.editalId ?? null,
    }),
  };
});

const mockUpsertSubject = vi.fn();
vi.mock("@/lib/knowledge/repositories/junction.repository", () => ({
  DocumentSubjectRepository: {
    upsert: (...a: unknown[]) => mockUpsertSubject(...a),
  },
}));


import { POST } from "@/app/api/admin/apostilas/batch/route";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import { IngestionError } from "@/lib/knowledge/services/ingestion.service";
import {
  DEFAULT_MCP_PROVIDER_ID,
  type KnowledgeMcpProvider,
} from "@/lib/knowledge/mcp/contracts";
import {
  registerMcpProvider,
  unregisterMcpProvider,
} from "@/lib/knowledge/mcp/registry";
import {
  APOSTILA_MCP_ID,
  APOSTILA_MCP_VERSION,
  APOSTILA_PROCESSING_VERSION,
} from "@/lib/knowledge/mcp/providers/apostila-mcp";

const SUBJECT_ID = "11111111-1111-4111-8111-111111111111";
const EDITAL_ID = "22222222-2222-4222-8222-222222222222";
const POSITION_ID = "33333333-3333-4333-8333-333333333333";

interface BatchRequestOptions {
  files?: Array<{ name: string; type: string }>;
  subjectId?: string | null;
  mcp?: string;
  editalId?: string;
  positionId?: string;
}

function batchRequest(options: BatchRequestOptions = {}): NextRequest {
  const fd = new FormData();
  if (options.subjectId !== null) {
    fd.append("subject_id", options.subjectId ?? SUBJECT_ID);
  }
  if (options.mcp !== undefined) fd.append("mcp_provider_id", options.mcp);
  if (options.editalId) fd.append("edital_id", options.editalId);
  if (options.positionId) fd.append("position_id", options.positionId);
  const files =
    options.files ?? [{ name: "aula-01.pdf", type: "application/pdf" }];
  for (const file of files) {
    fd.append(
      "files",
      new File([Buffer.from("conteudo de apostila")], file.name, {
        type: file.type,
      })
    );
  }
  return new NextRequest("http://localhost/api/admin/apostilas/batch", {
    method: "POST",
    body: fd,
  });
}

function pdfFiles(count: number): Array<{ name: string; type: string }> {
  return Array.from({ length: count }, (_, index) => ({
    name: "aula-" + (index + 1) + ".pdf",
    type: "application/pdf",
  }));
}

function stampOf(call: unknown[] | undefined): Record<string, unknown> {
  return ((call ?? [])[1] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mockGetSession.mockResolvedValue({
    userId: "admin-1",
    email: "admin@test.com",
  });
  mockRequireAdmin.mockResolvedValue(undefined);
  mockIngest.mockResolvedValue({
    documentId: "doc-1",
    storagePath: "admin-1/doc-1/aula-01.pdf",
    mimeType: "application/pdf",
    fileSize: 20,
    status: "processing",
    createdAt: new Date().toISOString(),
  });
  mockUpload.mockResolvedValue({ storagePath: "admin-1/doc-1/aula-01.pdf" });
  mockProcess.mockResolvedValue(undefined);
  mockUpdateMetadata.mockResolvedValue(undefined);
  mockUpdateAssociations.mockResolvedValue(undefined);
  mockFindById.mockResolvedValue({ status: "processing" });
  mockUpsertSubject.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  unregisterMcpProvider("no-ingest-mcp");
});


describe("POST /api/admin/apostilas/batch - autenticacao e autorizacao", () => {
  it("sem sessao admin responde 401 antes de ler o corpo", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(batchRequest());
    expect(res.status).toBe(401);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
    expect(mockIngest).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("sessao que nao e admin responde 403 com o codigo do guard", async () => {
    mockRequireAdmin.mockRejectedValue(
      new AdminError("FORBIDDEN", "Acesso restrito a administradores.")
    );
    const res = await POST(batchRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN");
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("erro inesperado vira 500 com mensagem fixa, sem vazar o original", async () => {
    mockRequireAdmin.mockRejectedValue(
      new Error("ECONNREFUSED postgres://secret-host:5432")
    );
    const res = await POST(batchRequest());
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("secret-host");
    expect(text).not.toContain("ECONNREFUSED");
  });
});

describe("POST /api/admin/apostilas/batch - validacao de entrada", () => {
  it("materia e obrigatoria: sem subject_id responde 400", async () => {
    const res = await POST(batchRequest({ subjectId: null }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("SUBJECT_REQUIRED");
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("subject_id que nao e uuid responde 400 SUBJECT_INVALID", async () => {
    const res = await POST(batchRequest({ subjectId: "materia-1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("SUBJECT_INVALID");
  });

  it("lote sem arquivos responde 400 NO_FILES", async () => {
    const res = await POST(batchRequest({ files: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("NO_FILES");
  });

  it("arquivo vazio (size 0) nao conta como arquivo do lote", async () => {
    const fd = new FormData();
    fd.append("subject_id", SUBJECT_ID);
    fd.append("files", new File([Buffer.from("")], "vazio.pdf", {
      type: "application/pdf",
    }));
    const res = await POST(
      new NextRequest("http://localhost/api/admin/apostilas/batch", {
        method: "POST",
        body: fd,
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("NO_FILES");
  });

  it("mais de 20 arquivos responde 400 TOO_MANY_FILES", async () => {
    const res = await POST(batchRequest({ files: pdfFiles(21) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("TOO_MANY_FILES");
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("mcp_provider_id malformado responde 422 sem mensagem crua do zod", async () => {
    const res = await POST(batchRequest({ mcp: "nome com espaco!" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("INVALID_MCP_PROVIDER");
    expect(typeof body.message).toBe("string");
    expect(mockIngest).not.toHaveBeenCalled();
  });
});


function providerWithoutIngest(): KnowledgeMcpProvider {
  return {
    id: "no-ingest-mcp",
    label: "Sem capacidade de ingestao",
    version: "0.1.0",
    processingVersion: "0.1.0.1",
    description: "Provedor de teste que nao declara a capacidade ingest.",
    capabilities: ["transform"],
    async plan(input) {
      return {
        providerId: "no-ingest-mcp",
        providerVersion: "0.1.0",
        processingVersion: "0.1.0.1",
        classification: "supported",
        title: input.fileName,
        kind: "apostila",
        subject: "teste",
        indexedByDefault: true,
        tags: ["teste"],
        metadata: {},
      };
    },
  };
}

describe("POST /api/admin/apostilas/batch - selecao e capacidade do MCP", () => {
  it("sem campo explicito usa o provedor padrao (apostila-mcp)", async () => {
    const res = await POST(batchRequest());
    expect(res.status).toBe(201);
    const stamp = stampOf(mockUpdateMetadata.mock.calls[0]);
    expect(stamp.mcp_provider_id).toBe(DEFAULT_MCP_PROVIDER_ID);
    expect(stamp.mcp_provider_id).toBe(APOSTILA_MCP_ID);
  });

  it("provedor inexistente responde 404 igual ao upload individual", async () => {
    const res = await POST(batchRequest({ mcp: "nao-existe-mcp" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("MCP_PROVIDER_NOT_FOUND");
    expect(mockIngest).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockUpdateMetadata).not.toHaveBeenCalled();
  });

  it("provedor sem capacidade ingest responde 422 antes de processar", async () => {
    registerMcpProvider(providerWithoutIngest());
    const res = await POST(batchRequest({ mcp: "no-ingest-mcp" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("MCP_CAPABILITY_UNAVAILABLE");
    expect(mockIngest).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("provedor alternativo valido entra no carimbo do documento", async () => {
    const res = await POST(batchRequest({ mcp: "mock-mcp" }));
    expect(res.status).toBe(201);
    const stamp = stampOf(mockUpdateMetadata.mock.calls[0]);
    expect(stamp.mcp_provider_id).toBe("mock-mcp");
    expect(stamp.mcp_version).toBe("0.0.0-test");
    expect(stamp.processing_version).toBe("0.0.0-test.processing");
  });
});


describe("POST /api/admin/apostilas/batch - resultado por arquivo", () => {
  it("lote valido responde 201 com uma linha por arquivo", async () => {
    const res = await POST(
      batchRequest({ editalId: EDITAL_ID, positionId: POSITION_ID })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.okCount).toBe(1);
    expect(body.failCount).toBe(0);
    // processing entrou no contrato da linha: o lote cria o documento e reporta
    // o estado da conversao na mesma resposta, sem transformar falha de
    // conversao em upload perdido.
    expect(body.results).toEqual([
      {
        fileName: "aula-01.pdf",
        documentId: "doc-1",
        status: "processing",
        processing: { status: "processing" },
      },
    ]);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpsertSubject).toHaveBeenCalledWith("doc-1", SUBJECT_ID, 100);
    expect(mockUpdateAssociations).toHaveBeenCalledWith("doc-1", {
      editalId: EDITAL_ID,
      positionId: POSITION_ID,
    });
  });

  it("o upload usa o nome sanitizado do storagePath, nunca o nome do cliente", async () => {
    await POST(batchRequest());
    const args = (mockUpload.mock.calls[0] ?? []) as Array<Record<string, unknown>>;
    expect(args[0].fileName).toBe("aula-01.pdf");
    expect(args[0].documentId).toBe("doc-1");
    expect(args[0].userId).toBe("admin-1");
  });

  it("carimbo separa versao do provedor da versao editorial", async () => {
    await POST(batchRequest());
    const stamp = stampOf(mockUpdateMetadata.mock.calls[0]);
    expect(stamp.mcp_version).toBe(APOSTILA_MCP_VERSION);
    expect(stamp.processing_version).toBe(APOSTILA_PROCESSING_VERSION);
    expect(stamp.processing_version).not.toBe(stamp.mcp_version);
    const mcp = stamp.mcp as Record<string, unknown>;
    expect(mcp.providerId).toBe(APOSTILA_MCP_ID);
    expect(mcp.providerVersion).toBe(APOSTILA_MCP_VERSION);
    expect(mcp.processingVersion).toBe(APOSTILA_PROCESSING_VERSION);
  });

  it("aula grifada entra como variante e conserva a ordem da aula", async () => {
    const res = await POST(
      batchRequest({
        files: [{ name: "aula-13-grifado.pdf", type: "application/pdf" }],
      })
    );
    expect(res.status).toBe(201);
    const stamp = stampOf(mockUpdateMetadata.mock.calls[0]);
    expect(stamp.variant).toBe("grifado");
    expect(stamp.lesson_order).toBe(13);
  });

  it("plano do MCP roda antes de qualquer escrita", async () => {
    const res = await POST(
      batchRequest({ files: [{ name: "capa.jpg", type: "image/jpeg" }] })
    );
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.results[0].code).toBe("MCP_REJECTED");
    expect(body.results[0].status).toBe("failed");
    expect(body.okCount).toBe(0);
    expect(body.failCount).toBe(1);
    expect(mockIngest).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockUpdateMetadata).not.toHaveBeenCalled();
  });

  it("lote continua apos rejeicao e processa o arquivo valido", async () => {
    const res = await POST(
      batchRequest({
        files: [
          { name: "capa.jpg", type: "image/jpeg" },
          { name: "aula-02.pdf", type: "application/pdf" },
        ],
      })
    );
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.okCount).toBe(1);
    expect(body.failCount).toBe(1);
    expect(body.results[0].code).toBe("MCP_REJECTED");
    expect(body.results[1].documentId).toBe("doc-1");
    expect(mockIngest).toHaveBeenCalledTimes(1);
  });

  it("erro de ingestao devolve o codigo de dominio e nao para o lote", async () => {
    mockIngest.mockRejectedValueOnce(
      new IngestionError("DUPLICATE_FILE", "Este arquivo ja foi enviado.")
    );
    const res = await POST(batchRequest({ files: pdfFiles(2) }));
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.results[0].code).toBe("DUPLICATE_FILE");
    expect(body.results[0].status).toBe("failed");
    expect(body.results[1].documentId).toBe("doc-1");
    expect(body.okCount).toBe(1);
    expect(body.failCount).toBe(1);
  });

  it("falha de storage nao vaza detalhe interno e nao interrompe o lote", async () => {
    mockUpload.mockRejectedValueOnce(
      new Error("putObject failed bucket=secret-bucket token=abc123")
    );
    const res = await POST(batchRequest({ files: pdfFiles(2) }));
    expect(res.status).toBe(207);
    const text = JSON.stringify(await res.json());
    expect(text).toContain("PROCESSING_FAILED");
    expect(text).not.toContain("secret-bucket");
    expect(text).not.toContain("abc123");
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });

  it("falha do pipeline nao altera o resultado do arquivo", async () => {
    mockProcess.mockRejectedValue(new Error("extracao falhou"));
    const res = await POST(batchRequest());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.okCount).toBe(1);
    expect(mockUpdateMetadata).toHaveBeenCalledTimes(1);
  });

  it("todos os arquivos falhando mantem 207 e okCount zero", async () => {
    mockIngest.mockRejectedValue(
      new IngestionError("FILE_TOO_LARGE", "Arquivo acima do limite.")
    );
    const res = await POST(batchRequest({ files: pdfFiles(2) }));
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.okCount).toBe(0);
    expect(body.failCount).toBe(2);
    expect(body.results.map((r: { status: string }) => r.status)).toEqual([
      "failed",
      "failed",
    ]);
  });
});
