/**
 * Escopo de compartilhamento no POST /api/admin/apostilas/batch.
 *
 * O lote so pode gravar cargo/edital que existem e pertencem ao mesmo concurso,
 * e a validacao roda uma unica vez por requisicao - antes de qualquer escrita.
 * Sem ids, o documento permanece privado: compartilhar nao e padrao implicito.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  queue: [] as unknown[][],
  selectCalls: 0,
}));

vi.mock("@/lib/db/drizzle", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            state.selectCalls += 1;
            const rows = state.queue.shift() ?? [];
            return {
              then: (onFulfilled: (v: unknown) => unknown) =>
                Promise.resolve(onFulfilled(rows)),
            };
          },
        }),
      }),
    }),
  },
}));

const mockGetSession = vi.fn();
vi.mock("@/lib/administration/session", () => ({
  getAdminSession: (...a: unknown[]) => mockGetSession(...a),
}));

vi.mock("@/lib/administration/services/admin-guard.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/administration/services/admin-guard.service")
  >();
  return {
    ...actual,
    AdminGuardService: {
      ...actual.AdminGuardService,
      requireAdmin: () => Promise.resolve(),
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

vi.mock("@/lib/knowledge/services/document-pipeline.service", () => ({
  DocumentPipelineService: { processDocument: () => Promise.resolve({ status: "chunked" }) },
}));

const mockUpdateAssociations = vi.fn();
vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {
    updateMetadata: () => Promise.resolve(),
    updateAssociations: (...a: unknown[]) => mockUpdateAssociations(...a),
    findById: () => Promise.resolve({ status: "chunked" }),
  },
}));

vi.mock("@/lib/knowledge/repositories/junction.repository", () => ({
  DocumentSubjectRepository: { upsert: () => Promise.resolve() },
}));

import { POST } from "@/app/api/admin/apostilas/batch/route";

const SUBJECT_ID = "11111111-1111-4111-8111-111111111111";
const CONTEST_A = "44444444-4444-4444-8444-444444444444";
const POSITION = "55555555-5555-4555-8555-555555555555";
const EDITAL = "66666666-6666-4666-8666-666666666666";
const EDITAL_OUTRO = "77777777-7777-4777-8777-777777777777";

function batchRequest(fields: Record<string, string> = {}): NextRequest {
  const fd = new FormData();
  fd.append("subject_id", SUBJECT_ID);
  for (const [key, value] of Object.entries(fields)) fd.append(key, value);
  fd.append(
    "files",
    new File([Buffer.from("conteudo de apostila")], "aula-01.pdf", {
      type: "application/pdf",
    })
  );
  return new NextRequest("http://localhost/api/admin/apostilas/batch", {
    method: "POST",
    body: fd,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.queue = [];
  state.selectCalls = 0;
  mockGetSession.mockResolvedValue({ userId: "adm-1", email: "admin@exemplo.com" });
  mockIngest.mockResolvedValue({
    documentId: "doc-1",
    storagePath: "documents/doc-1/aula-01.pdf",
    mimeType: "application/pdf",
    status: "pending",
  });
  mockUpload.mockResolvedValue(undefined);
  mockUpdateAssociations.mockResolvedValue(undefined);
});

describe("POST /api/admin/apostilas/batch - escopo de compartilhamento", () => {
  it("cargo inexistente devolve 400 antes de qualquer ingestao", async () => {
    state.queue = [[]];

    const res = await batchRequest({ position_id: POSITION });
    const response = await POST(res);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("SCOPE_NOT_FOUND");
    expect(mockIngest).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("id fora do formato e recusado sem consultar o banco", async () => {
    const response = await POST(batchRequest({ position_id: "cargo-do-professor" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("INVALID_SCOPE_ID");
    expect(state.selectCalls).toBe(0);
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("cargo e edital de concursos diferentes sao recusados", async () => {
    state.queue = [
      [{ id: POSITION, contestId: CONTEST_A, editalId: null }],
      [{ id: EDITAL_OUTRO, contestId: "88888888-8888-4888-8888-888888888888" }],
    ];

    const response = await POST(
      batchRequest({ position_id: POSITION, edital_id: EDITAL_OUTRO })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("SCOPE_MISMATCH");
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("escopo valido e gravado no documento, herdando o edital do cargo", async () => {
    state.queue = [[{ id: POSITION, contestId: CONTEST_A, editalId: EDITAL }]];

    const response = await POST(batchRequest({ position_id: POSITION }));

    expect(response.status).toBe(201);
    expect(mockUpdateAssociations).toHaveBeenCalledWith("doc-1", {
      editalId: EDITAL,
      positionId: POSITION,
    });
    // validacao unica por requisicao, nao uma por arquivo
    expect(state.selectCalls).toBe(1);
  });

  it("lote sem ids nao compartilha nada", async () => {
    const response = await POST(batchRequest());

    expect(response.status).toBe(201);
    expect(state.selectCalls).toBe(0);
    expect(mockUpdateAssociations).not.toHaveBeenCalled();
  });
});