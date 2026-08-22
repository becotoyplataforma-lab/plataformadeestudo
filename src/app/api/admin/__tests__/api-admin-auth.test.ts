/**
 * Testes de autorização das API routes /api/admin/* que foram corrigidas
 * para exigir AdminGuardService.requireAdmin (allowlist), além da autenticação.
 *
 * Cobre os 3 cenários por rota:
 *   1. usuário não autenticado → 401;
 *   2. usuário autenticado mas não-admin → 403;
 *   3. usuário admin → comportamento atual preservado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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

// --- Mocks dos serviços/repositórios usados pelas rotas corrigidas ---
const mockAvatarList = vi.fn();
const mockAvatarCreate = vi.fn();
vi.mock("@/lib/ai/repositories/avatar.repository", () => ({
  AvatarRepository: {
    listActive: (...a: unknown[]) => mockAvatarList(...a),
    create: (...a: unknown[]) => mockAvatarCreate(...a),
  },
}));

const mockContestAnalyze = vi.fn();
vi.mock("@/lib/contest/services/contest-intelligence.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/contest/services/contest-intelligence.service")
  >();
  return {
    ...actual,
    ContestIntelligenceService: {
      analyze: (...a: unknown[]) => mockContestAnalyze(...a),
    },
  };
});

const mockDocFindById = vi.fn();
const mockDocUpdateReview = vi.fn();
const mockDocUpdateMetadata = vi.fn();
const mockDocListExternal = vi.fn();
vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {
    findById: (...a: unknown[]) => mockDocFindById(...a),
    updateReview: (...a: unknown[]) => mockDocUpdateReview(...a),
    updateMetadata: (...a: unknown[]) => mockDocUpdateMetadata(...a),
    listExternalSources: (...a: unknown[]) => mockDocListExternal(...a),
  },
}));

const mockChunkList = vi.fn();
vi.mock("@/lib/knowledge/repositories/chunk.repository", () => ({
  DocumentChunkRepository: {
    listByDocument: (...a: unknown[]) => mockChunkList(...a),
  },
}));

const mockEditalApply = vi.fn();
vi.mock("@/lib/administration/services/edital.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/administration/services/edital.service")
  >();
  return {
    ...actual,
    EditalApplyService: {
      apply: (...a: unknown[]) => mockEditalApply(...a),
    },
  };
});

const mockEditalParse = vi.fn();
vi.mock("@/lib/ai/services/edital-parsing.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/ai/services/edital-parsing.service")
  >();
  return {
    ...actual,
    EditalParsingService: {
      parseFromDocument: (...a: unknown[]) => mockEditalParse(...a),
    },
  };
});

const mockUrlImport = vi.fn();
vi.mock("@/lib/knowledge/services/url-import.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/knowledge/services/url-import.service")
  >();
  return {
    ...actual,
    UrlImportService: {
      importFromUrl: (...a: unknown[]) => mockUrlImport(...a),
    },
  };
});

const mockLessonGenerate = vi.fn();
vi.mock("@/lib/ai/services/lesson-generation.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/ai/services/lesson-generation.service")
  >();
  return {
    ...actual,
    LessonGenerationService: {
      generateFromDocument: (...a: unknown[]) => mockLessonGenerate(...a),
    },
  };
});

const mockQuestionGenerate = vi.fn();
vi.mock("@/lib/ai/services/question-generation.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/ai/services/question-generation.service")
  >();
  return {
    ...actual,
    QuestionGenerationService: {
      generateFromDocument: (...a: unknown[]) => mockQuestionGenerate(...a),
    },
  };
});

const mockQuestionImport = vi.fn();
vi.mock("@/lib/administration/services/question-import.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/administration/services/question-import.service")
  >();
  return {
    ...actual,
    QuestionImportService: {
      importQuestions: (...a: unknown[]) => mockQuestionImport(...a),
    },
  };
});

const mockIngest = vi.fn();
vi.mock("@/lib/knowledge/services/ingestion.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/knowledge/services/ingestion.service")
  >();
  return {
    ...actual,
    IngestionService: {
      ingest: (...a: unknown[]) => mockIngest(...a),
    },
  };
});

const mockSubjectGetAll = vi.fn();
const mockSubjectCreate = vi.fn();
vi.mock("@/lib/knowledge/repositories/subject.repository", () => ({
  KnowledgeSubjectRepository: {
    getAll: (...a: unknown[]) => mockSubjectGetAll(...a),
    findBySlug: vi.fn().mockResolvedValue(null),
    create: (...a: unknown[]) => mockSubjectCreate(...a),
  },
}));

const mockSettingGet = vi.fn();
vi.mock("@/lib/administration/services/system-setting.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/administration/services/system-setting.service")
  >();
  return {
    ...actual,
    SystemSettingService: {
      ...actual.SystemSettingService,
      get: (...a: unknown[]) => mockSettingGet(...a),
    },
  };
});

// --- Imports das rotas corrigidas ---
import { GET as getAvatares, POST as postAvatares } from "@/app/api/admin/avatares/route";
import { GET as getContestIntelligence } from "@/app/api/admin/contest-intelligence/route";
import { POST as postDocReview } from "@/app/api/admin/documents/[id]/review/route";
import { POST as postDocFonte } from "@/app/api/admin/documents/[id]/fonte/route";
import { GET as getDocPreview } from "@/app/api/admin/documents/[id]/preview/route";
import { GET as getFontes } from "@/app/api/admin/fontes/route";
import { POST as postEditalApply } from "@/app/api/admin/editais/apply/route";
import { POST as postEditalParse } from "@/app/api/admin/editais/parse/route";
import { POST as postUrlImport } from "@/app/api/admin/import/url/route";
import { POST as postLessonGenerate } from "@/app/api/admin/lessons/generate/route";
import { POST as postQuestionGenerate } from "@/app/api/admin/questions/generate/route";
import { POST as postQuestionImport } from "@/app/api/admin/questions/import/route";
import { GET as getTemplate } from "@/app/api/admin/questions/import/template/route";
import { POST as postBatch } from "@/app/api/admin/apostilas/batch/route";
import { GET as getSubjects, POST as postSubjects } from "@/app/api/admin/subjects/route";
import { GET as getSetting } from "@/app/api/admin/settings/[key]/route";
import { AdminError } from "@/lib/administration/services/admin-guard.service";

const ADMIN = { userId: "a1", email: "admin@x.com" };
const UUID = "00000000-0000-0000-0000-000000000001";

function jsonReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function formReq(): NextRequest {
  const fd = new FormData();
  fd.append("subject_id", UUID);
  fd.append("files", new File(["conteudo"], "apostila.pdf", { type: "application/pdf" }));
  return new NextRequest("http://localhost/api/admin/test", {
    method: "POST",
    body: fd,
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("Autorização admin nas APIs corrigidas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(ADMIN);
    mockRequireAdmin.mockResolvedValue(undefined);
    // defaults de sucesso para admin
    mockAvatarList.mockResolvedValue([]);
    mockAvatarCreate.mockResolvedValue({ id: UUID, nome: "A", slug: "a" });
    mockContestAnalyze.mockResolvedValue({ ok: true });
    mockDocFindById.mockResolvedValue({ id: UUID, title: "Doc", status: "chunked", reviewStatus: "pendente", chunkCount: 0, createdAt: new Date(), updatedAt: new Date() });
    mockDocUpdateReview.mockResolvedValue({ id: UUID, title: "Doc", status: "chunked", reviewStatus: "aprovado", chunkCount: 0, createdAt: new Date(), updatedAt: new Date() });
    mockDocUpdateMetadata.mockResolvedValue({ id: UUID });
    mockDocListExternal.mockResolvedValue([]);
    mockChunkList.mockResolvedValue([]);
    mockEditalApply.mockResolvedValue({ ok: true });
    mockEditalParse.mockResolvedValue({ suggestions: [] });
    mockUrlImport.mockResolvedValue({ documentId: UUID });
    mockLessonGenerate.mockResolvedValue({ id: UUID, title: "Aula", duracaoMin: 10, roteiro: [] });
    mockQuestionGenerate.mockResolvedValue({ created: 1 });
    mockQuestionImport.mockResolvedValue({ imported: 1, skipped: 0, errors: [] });
    mockIngest.mockResolvedValue({ documentId: UUID, status: "processing", mimeType: "application/pdf" });
    mockSubjectGetAll.mockResolvedValue([]);
    mockSubjectCreate.mockResolvedValue({ id: UUID, name: "Matéria", slug: "materia" });
    mockSettingGet.mockResolvedValue("valor");
  });

  // Helper: roda um caso "não-admin → 403" para um handler
  async function expectForbidden(handler: () => Promise<Response>) {
    mockRequireAdmin.mockRejectedValue(
      new AdminError("FORBIDDEN", "Acesso restrito a administradores.")
    );
    const res = await handler();
    expect(res.status).toBe(403);
  }

  // Helper: roda um caso "sem sessão → 401"
  async function expectUnauthorized(handler: () => Promise<Response>) {
    mockGetSession.mockResolvedValue(null);
    const res = await handler();
    expect(res.status).toBe(401);
  }

  describe("avatares", () => {
    it("GET sem sessão → 401", () => expectUnauthorized(() => getAvatares()));
    it("GET não-admin → 403", () => expectForbidden(() => getAvatares()));
    it("GET admin → 200", async () => {
      const res = await getAvatares();
      expect(res.status).toBe(200);
    });
    it("POST sem sessão → 401", () => expectUnauthorized(() => postAvatares(jsonReq({ nome: "Avatar", slug: "avatar" }))));
    it("POST não-admin → 403", () => expectForbidden(() => postAvatares(jsonReq({ nome: "Avatar", slug: "avatar" }))));
    it("POST admin → 201", async () => {
      const res = await postAvatares(jsonReq({ nome: "Avatar", slug: "avatar" }));
      expect(res.status).toBe(201);
    });
  });

  describe("contest-intelligence", () => {
    it("GET sem sessão → 401", () =>
      expectUnauthorized(() => getContestIntelligence(new NextRequest("http://localhost/api/admin/contest-intelligence?edital_id=" + UUID))));
    it("GET não-admin → 403", () =>
      expectForbidden(() => getContestIntelligence(new NextRequest("http://localhost/api/admin/contest-intelligence?edital_id=" + UUID))));
    it("GET admin → 200", async () => {
      const res = await getContestIntelligence(new NextRequest("http://localhost/api/admin/contest-intelligence?edital_id=" + UUID));
      expect(res.status).toBe(200);
    });
  });

  describe("documents/[id]/review", () => {
    it("POST sem sessão → 401", () =>
      expectUnauthorized(() => postDocReview(jsonReq({ action: "aprovar" }), params(UUID))));
    it("POST não-admin → 403", () =>
      expectForbidden(() => postDocReview(jsonReq({ action: "aprovar" }), params(UUID))));
    it("POST admin → 200", async () => {
      const res = await postDocReview(jsonReq({ action: "aprovar" }), params(UUID));
      expect(res.status).toBe(200);
    });
  });

  describe("documents/[id]/fonte", () => {
    it("POST sem sessão → 401", () =>
      expectUnauthorized(() => postDocFonte(jsonReq({ fonte: "X" }), params(UUID))));
    it("POST não-admin → 403", () =>
      expectForbidden(() => postDocFonte(jsonReq({ fonte: "X" }), params(UUID))));
    it("POST admin → 200", async () => {
      const res = await postDocFonte(jsonReq({ fonte: "X" }), params(UUID));
      expect(res.status).toBe(200);
    });
  });

  describe("documents/[id]/preview", () => {
    it("GET sem sessão → 401", () =>
      expectUnauthorized(() => getDocPreview(new NextRequest("http://localhost/api/admin/documents/x/preview"), params(UUID))));
    it("GET não-admin → 403", () =>
      expectForbidden(() => getDocPreview(new NextRequest("http://localhost/api/admin/documents/x/preview"), params(UUID))));
    it("GET admin → 200", async () => {
      const res = await getDocPreview(new NextRequest("http://localhost/api/admin/documents/x/preview"), params(UUID));
      expect(res.status).toBe(200);
    });
  });

  describe("fontes", () => {
    it("GET sem sessão → 401", () => expectUnauthorized(() => getFontes()));
    it("GET não-admin → 403", () => expectForbidden(() => getFontes()));
    it("GET admin → 200", async () => {
      const res = await getFontes();
      expect(res.status).toBe(200);
    });
  });

  describe("editais/apply", () => {
    const body = { document_id: UUID, contest_id: UUID, materias: [{ name: "Português", weight: 50 }] };
    it("POST sem sessão → 401", () => expectUnauthorized(() => postEditalApply(jsonReq(body))));
    it("POST não-admin → 403", () => expectForbidden(() => postEditalApply(jsonReq(body))));
    it("POST admin → 201", async () => {
      const res = await postEditalApply(jsonReq(body));
      expect(res.status).toBe(201);
    });
  });

  describe("editais/parse", () => {
    it("POST sem sessão → 401", () => expectUnauthorized(() => postEditalParse(jsonReq({ document_id: UUID }))));
    it("POST não-admin → 403", () => expectForbidden(() => postEditalParse(jsonReq({ document_id: UUID }))));
    it("POST admin → 200", async () => {
      const res = await postEditalParse(jsonReq({ document_id: UUID }));
      expect(res.status).toBe(200);
    });
  });

  describe("import/url", () => {
    it("POST sem sessão → 401", () => expectUnauthorized(() => postUrlImport(jsonReq({ url: "https://exemplo.com" }))));
    it("POST não-admin → 403", () => expectForbidden(() => postUrlImport(jsonReq({ url: "https://exemplo.com" }))));
    it("POST admin → 201", async () => {
      const res = await postUrlImport(jsonReq({ url: "https://exemplo.com" }));
      expect(res.status).toBe(201);
    });
  });

  describe("lessons/generate", () => {
    const body = { document_id: UUID, subject_id: UUID };
    it("POST sem sessão → 401", () => expectUnauthorized(() => postLessonGenerate(jsonReq(body))));
    it("POST não-admin → 403", () => expectForbidden(() => postLessonGenerate(jsonReq(body))));
    it("POST admin → 201", async () => {
      const res = await postLessonGenerate(jsonReq(body));
      expect(res.status).toBe(201);
    });
  });

  describe("questions/generate", () => {
    const body = { document_id: UUID, subject_id: UUID, quantity: 5 };
    it("POST sem sessão → 401", () => expectUnauthorized(() => postQuestionGenerate(jsonReq(body))));
    it("POST não-admin → 403", () => expectForbidden(() => postQuestionGenerate(jsonReq(body))));
    it("POST admin → 201", async () => {
      const res = await postQuestionGenerate(jsonReq(body));
      expect(res.status).toBe(201);
    });
  });

  describe("questions/import", () => {
    it("POST sem sessão → 401", () => expectUnauthorized(() => postQuestionImport(formReq())));
    it("POST não-admin → 403", () => expectForbidden(() => postQuestionImport(formReq())));
  });

  describe("questions/import/template", () => {
    it("GET sem sessão → 401", () => expectUnauthorized(() => getTemplate()));
    it("GET não-admin → 403", () => expectForbidden(() => getTemplate()));
    it("GET admin → 200", async () => {
      const res = await getTemplate();
      expect(res.status).toBe(200);
    });
  });

  describe("apostilas/batch", () => {
    it("POST sem sessão → 401", () => expectUnauthorized(() => postBatch(formReq())));
    it("POST não-admin → 403", () => expectForbidden(() => postBatch(formReq())));
  });

  describe("subjects", () => {
    it("GET sem sessão → 401", () => expectUnauthorized(() => getSubjects()));
    it("GET não-admin → 403", () => expectForbidden(() => getSubjects()));
    it("GET admin → 200", async () => {
      const res = await getSubjects();
      expect(res.status).toBe(200);
    });
    it("POST sem sessão → 401", () => expectUnauthorized(() => postSubjects(jsonReq({ name: "Matéria" }))));
    it("POST não-admin → 403", () => expectForbidden(() => postSubjects(jsonReq({ name: "Matéria" }))));
    it("POST admin → 201", async () => {
      const res = await postSubjects(jsonReq({ name: "Matéria" }));
      expect(res.status).toBe(201);
    });
  });

  describe("settings/[key]", () => {
    const keyParams = () => ({ params: Promise.resolve({ key: "x" }) });
    it("GET sem sessão → 401", () =>
      expectUnauthorized(() => getSetting(new NextRequest("http://localhost/api/admin/settings/x"), keyParams())));
    it("GET não-admin → 403", () =>
      expectForbidden(() => getSetting(new NextRequest("http://localhost/api/admin/settings/x"), keyParams())));
    it("GET admin → 200", async () => {
      const res = await getSetting(new NextRequest("http://localhost/api/admin/settings/x"), keyParams());
      expect(res.status).toBe(200);
    });
  });
});
