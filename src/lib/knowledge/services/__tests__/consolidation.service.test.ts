import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/services/deepseek-provider.service", () => ({
  DeepSeekProvider: {
    complete: vi.fn(),
  },
}));
vi.mock("../../repositories/document.repository", () => ({
  DocumentRepository: {
    findById: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock("../../repositories/chunk.repository", () => ({
  DocumentChunkRepository: {
    listByDocument: vi.fn().mockResolvedValue([{ id: "c1", content: "conteúdo", seq: 1 }]),
  },
}));
vi.mock("../../storage.service", () => ({
  DocumentStorageService: { upload: vi.fn().mockResolvedValue("path") },
}));
vi.mock("../document-pipeline.service", () => ({
  DocumentPipelineService: { processDocument: vi.fn().mockResolvedValue({ status: "chunked" }) },
}));
vi.mock("../../repositories/junction.repository", () => ({
  DocumentSubjectRepository: {
    listSubjectsByDocuments: vi.fn(),
    upsert: vi.fn().mockResolvedValue(null),
  },
}));
vi.mock("../../repositories/subject.repository", () => ({
  KnowledgeSubjectRepository: {
    findById: vi.fn().mockResolvedValue({ id: "s1", name: "Português" }),
  },
}));

import { DeepSeekProvider } from "@/lib/ai/services/deepseek-provider.service";
import { DocumentRepository } from "../../repositories/document.repository";
import { DocumentSubjectRepository } from "../../repositories/junction.repository";
import { ConsolidationService } from "../consolidation.service";

const chunkedDoc = (id: string, userId = "u1") => ({
  id,
  userId,
  status: "chunked",
  reviewStatus: "pendente",
  sourceType: "upload",
  title: `Apostila ${id}`,
});

describe("ConsolidationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
  });

  it("bloqueia com menos de 2 documentos", async () => {
    await expect(
      ConsolidationService.consolidate({
        userId: "u1",
        isAdmin: false,
        documentIds: ["d1"],
        subjectId: "s1",
      })
    ).rejects.toMatchObject({ code: "MIN_DOCUMENTS" });
  });

  it("bloqueia documento não processado", async () => {
    (DocumentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...chunkedDoc("d1"),
      status: "pending",
    });

    await expect(
      ConsolidationService.consolidate({
        userId: "u1",
        isAdmin: false,
        documentIds: ["d1", "d2"],
        subjectId: "s1",
      })
    ).rejects.toMatchObject({ code: "DOC_NOT_READY" });
  });

  it("bloqueia matérias misturadas", async () => {
    (DocumentRepository.findById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(chunkedDoc("d1"))
      .mockResolvedValueOnce(chunkedDoc("d2"));
    (DocumentSubjectRepository.listSubjectsByDocuments as ReturnType<typeof vi.fn>).mockResolvedValue([
      { documentId: "d1", subjectId: "s1", subjectName: "Português" },
      { documentId: "d2", subjectId: "s2", subjectName: "Matemática" },
    ]);

    await expect(
      ConsolidationService.consolidate({
        userId: "u1",
        isAdmin: false,
        documentIds: ["d1", "d2"],
        subjectId: "s1",
      })
    ).rejects.toMatchObject({ code: "MIXED_SUBJECTS" });
  });

  it("bloqueia apostila de outro usuário (não-admin)", async () => {
    (DocumentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      chunkedDoc("d1", "outro-usuario")
    );

    await expect(
      ConsolidationService.consolidate({
        userId: "u1",
        isAdmin: false,
        documentIds: ["d1", "d2"],
        subjectId: "s1",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("consolida com sucesso (síntese via IA)", async () => {
    (DocumentRepository.findById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(chunkedDoc("d1"))
      .mockResolvedValueOnce(chunkedDoc("d2"))
      .mockResolvedValueOnce(chunkedDoc("d1")); // final fetch
    (DocumentSubjectRepository.listSubjectsByDocuments as ReturnType<typeof vi.fn>).mockResolvedValue([
      { documentId: "d1", subjectId: "s1", subjectName: "Português" },
      { documentId: "d2", subjectId: "s1", subjectName: "Português" },
    ]);
    (DeepSeekProvider.complete as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: "# Resumo consolidado\n\nConteúdo.",
      model: "pro",
      tokensIn: 10,
      tokensOut: 20,
    });
    (DocumentRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "consolidado-1",
      title: "Consolidado — Português",
    });

    const result = await ConsolidationService.consolidate({
      userId: "u1",
      isAdmin: false,
      documentIds: ["d1", "d2"],
      subjectId: "s1",
    });

    expect(result.documentId).toBeTruthy();
    expect(result.sourceDocumentIds).toEqual(["d1", "d2"]);
    expect(DeepSeekProvider.complete).toHaveBeenCalledWith(
      expect.objectContaining({ model: "pro" })
    );
    expect(DocumentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "consolidated",
        sourceDocumentIds: ["d1", "d2"],
        type: "markdown",
      })
    );
  });

  it("retorna AI_NOT_CONFIGURED sem chave", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    (DocumentRepository.findById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(chunkedDoc("d1"))
      .mockResolvedValueOnce(chunkedDoc("d2"));
    (DocumentSubjectRepository.listSubjectsByDocuments as ReturnType<typeof vi.fn>).mockResolvedValue([
      { documentId: "d1", subjectId: "s1", subjectName: "Português" },
      { documentId: "d2", subjectId: "s1", subjectName: "Português" },
    ]);

    await expect(
      ConsolidationService.consolidate({
        userId: "u1",
        isAdmin: false,
        documentIds: ["d1", "d2"],
        subjectId: "s1",
      })
    ).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
  });
});
