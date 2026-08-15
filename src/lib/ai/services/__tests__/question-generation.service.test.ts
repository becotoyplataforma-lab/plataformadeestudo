import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  QuestionGenerationService,
  GenerationServiceError,
} from "../question-generation.service";

vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {
    findById: vi.fn(),
  },
}));
vi.mock("@/lib/knowledge/repositories/chunk.repository", () => ({
  DocumentChunkRepository: {
    listByDocument: vi.fn().mockResolvedValue([{ id: "c1", content: "conteúdo", seq: 1 }]),
  },
}));
vi.mock("@/lib/knowledge/repositories/subject.repository", () => ({
  KnowledgeSubjectRepository: {
    findById: vi.fn().mockResolvedValue({ id: "s1", name: "Matéria" }),
  },
}));
vi.mock("../../generation/question-generation.provider", () => ({
  questionGenerationProvider: {
    generateQuestions: vi.fn(),
  },
}));
vi.mock("../question-validation.service", () => ({
  QuestionValidationService: {
    validate: vi.fn().mockReturnValue({ valid: true, score: 1, issues: [] }),
  },
}));
vi.mock("@/lib/administration/repositories/question.repository", () => ({
  QuestionWriteRepository: {
    createQuestion: vi.fn().mockResolvedValue({ id: "q1" }),
    createOptions: vi.fn().mockResolvedValue([]),
    createModerationEvent: vi.fn().mockResolvedValue(null),
  },
}));

import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { questionGenerationProvider } from "../../generation/question-generation.provider";
import { QuestionValidationService } from "../question-validation.service";
import { QuestionWriteRepository } from "@/lib/administration/repositories/question.repository";

const baseInput = {
  adminUserId: "u1",
  documentId: "d1",
  subjectId: "s1",
  quantity: 1,
};

const validQuestion = {
  enunciado: "Qual é a capital?",
  gabarito: "A",
  dificuldade: "medio",
  alternativas: ["Rio", "SP", "Brasília", "Salvador", "BH"],
  explicacao: "x",
  topico: "t",
};

describe("QuestionGenerationService — gate de revisão de conteúdo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bloqueia geração quando o documento foi rejeitado (DOC_REJECTED)", async () => {
    (DocumentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "d1",
      status: "chunked",
      reviewStatus: "rejeitado",
      title: "Apostila",
    });

    await expect(
      QuestionGenerationService.generateFromDocument(baseInput)
    ).rejects.toMatchObject({
      code: "DOC_REJECTED",
    });
    expect(questionGenerationProvider.generateQuestions).not.toHaveBeenCalled();
  });

  it("permite geração para documento pendente e processado", async () => {
    (DocumentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "d1",
      status: "indexed",
      reviewStatus: "pendente",
      title: "Apostila",
    });
    (questionGenerationProvider.generateQuestions as ReturnType<typeof vi.fn>).mockResolvedValue([
      validQuestion,
    ]);

    const result = await QuestionGenerationService.generateFromDocument(baseInput);
    expect(result.generated).toBe(1);
    expect(QuestionWriteRepository.createQuestion).toHaveBeenCalled();
  });

  it("mantém erro DOC_NOT_READY para documento não processado", async () => {
    (DocumentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "d1",
      status: "pending",
      reviewStatus: "pendente",
      title: "Apostila",
    });

    await expect(
      QuestionGenerationService.generateFromDocument(baseInput)
    ).rejects.toMatchObject({ code: "DOC_NOT_READY" });
  });

  it("lança DOC_NOT_FOUND para documento inexistente", async () => {
    (DocumentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      QuestionGenerationService.generateFromDocument(baseInput)
    ).rejects.toBeInstanceOf(GenerationServiceError);
  });

  it("não chama o validador quando o provider retorna lista vazia", async () => {
    (DocumentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "d1",
      status: "chunked",
      reviewStatus: "pendente",
      title: "Apostila",
    });
    (questionGenerationProvider.generateQuestions as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    );

    const result = await QuestionGenerationService.generateFromDocument(baseInput);
    expect(result.generated).toBe(0);
    expect(QuestionValidationService.validate).not.toHaveBeenCalled();
  });
});
