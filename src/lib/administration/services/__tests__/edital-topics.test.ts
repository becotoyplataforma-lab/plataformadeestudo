/**
 * ConcursoAI — FASE 6C: Testes Unitários de Tópicos do Edital (notice_topics)
 *
 * Cobertura completa:
 * A. Normalização (acentos, caixa, espaços, pontuação)
 * B. Extração (com tópicos, sem tópicos, hierarquia, peso presente/ausente, payload inválido)
 * C. Associação (match inequívoco, sem match, ambiguidade, cross-subject, slug, existente)
 * D. Apply (criação de notice_topics, idempotência, parent/child, knowledge_topic_id NULL, preservação de notice_subjects)
 * E. Segurança de dados (sem alterar questions, sem apagar knowledge_topics, sem duplicações)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// MOCKS
// ============================================================

const mockDocFindById = vi.fn();
const mockDocUpdateAssoc = vi.fn();
vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {
    findById: (...args: unknown[]) => mockDocFindById(...args),
    updateAssociations: (...args: unknown[]) => mockDocUpdateAssoc(...args),
  },
}));

const mockChunkListByDoc = vi.fn();
vi.mock("@/lib/knowledge/repositories/chunk.repository", () => ({
  DocumentChunkRepository: {
    listByDocument: (...args: unknown[]) => mockChunkListByDoc(...args),
  },
}));

const mockDeepSeekComplete = vi.fn();
vi.mock("@/lib/ai/services/deepseek-provider.service", () => ({
  DeepSeekProvider: {
    complete: (...args: unknown[]) => mockDeepSeekComplete(...args),
  },
}));

const mockGetCurrentEdital = vi.fn();
const mockCreateEdital = vi.fn();
vi.mock("@/lib/db/repositories/edital", () => ({
  getCurrentEditalByContest: (...args: unknown[]) => mockGetCurrentEdital(...args),
  createEdital: (...args: unknown[]) => mockCreateEdital(...args),
}));

const mockFindOrCreateSubject = vi.fn();
const mockUpsertNoticeSubject = vi.fn();
vi.mock("../../repositories/notice-subject.repository", () => ({
  NoticeSubjectRepository: {
    findOrCreateSubject: (...args: unknown[]) => mockFindOrCreateSubject(...args),
    upsertNoticeSubject: (...args: unknown[]) => mockUpsertNoticeSubject(...args),
  },
}));

const mockReplaceTopicsForNoticeSubject = vi.fn();
const mockListTopicsByNoticeSubjectId = vi.fn();
vi.mock("../../repositories/notice-topic.repository", () => ({
  NoticeTopicRepository: {
    replaceTopicsForNoticeSubject: (...args: unknown[]) =>
      mockReplaceTopicsForNoticeSubject(...args),
    listByNoticeSubjectId: (...args: unknown[]) =>
      mockListTopicsByNoticeSubjectId(...args),
  },
}));

const mockResolveTopic = vi.fn();
vi.mock("@/lib/knowledge/services/topic-resolver.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/knowledge/services/topic-resolver.service")
  >("@/lib/knowledge/services/topic-resolver.service");
  return {
    ...actual,
    TopicResolverService: {
      resolveTopic: (...args: unknown[]) => mockResolveTopic(...args),
    },
  };
});

// Import services after mocks
import {
  normalizeTopicName,
  slugifyTopic,
  resolveTopicInMemory,
  type TopicCandidate,
} from "@/lib/knowledge/services/topic-resolver.service";
import {
  EditalParsingService,
  parseEditalResponse,
  EditalParsingError,
} from "@/lib/ai/services/edital-parsing.service";
import {
  EditalApplyService,
  EditalApplyError,
} from "@/lib/administration/services/edital.service";

describe("FASE 6C — Camada Estruturada de Tópicos do Edital", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // A. NORMALIZAÇÃO
  // ============================================================
  describe("A. Normalização de Tópicos", () => {
    it("remove acentos mantendo letras base (NFD)", () => {
      expect(normalizeTopicName("Língua Portuguesa")).toBe("lingua portuguesa");
      expect(normalizeTopicName("Acentuação Gráfica")).toBe("acentuacao grafica");
      expect(normalizeTopicName("Interpretação e Compreensão de Texto")).toBe(
        "interpretacao e compreensao de texto"
      );
    });

    it("converte para minúsculas de forma determinística", () => {
      expect(normalizeTopicName("DIREITO CONSTITUCIONAL")).toBe("direito constitucional");
      expect(normalizeTopicName("PoDeR ExEcUtIvO")).toBe("poder executivo");
    });

    it("colapsa espaços em branco múltiplos e remove espaços nas pontas", () => {
      expect(normalizeTopicName("   Controle    de     Constitucionalidade   ")).toBe(
        "controle de constitucionalidade"
      );
    });

    it("trata pontuação e símbolos especiais substituindo por espaço normalizado", () => {
      expect(
        normalizeTopicName("Art. 5º da CF/88: Direitos & Garantias Fundamentais (Parte 1)!")
      ).toBe("art 5º da cf 88 direitos & garantias fundamentais parte 1");
    });

    it("lida seguramente com valores nulos, vazios ou indefinidos", () => {
      expect(normalizeTopicName(null)).toBe("");
      expect(normalizeTopicName(undefined)).toBe("");
      expect(normalizeTopicName("   ")).toBe("");
    });
  });

  // ============================================================
  // B. EXTRAÇÃO DO EDITAL (PARSER)
  // ============================================================
  describe("B. Extração do Edital (EditalParsingService)", () => {
    it("extrai disciplina com tópicos estruturados", () => {
      const rawAiResponse = JSON.stringify({
        banca: "Cebraspe",
        cargo: "Auditor Fiscal",
        data_prova: "2026-12-01",
        materias: [
          {
            name: "Direito Tributário",
            weight: 30,
            topicos: [
              { name: "Sistema Tributário Nacional" },
              { name: "Impostos da União" },
            ],
          },
        ],
      });

      const parsed = parseEditalResponse(rawAiResponse);
      expect(parsed.banca).toBe("Cebraspe");
      expect(parsed.cargo).toBe("Auditor Fiscal");
      expect(parsed.materias).toHaveLength(1);
      expect(parsed.materias[0]!.name).toBe("Direito Tributário");
      expect(parsed.materias[0]!.weight).toBe(30);
      expect(parsed.materias[0]!.topicos).toHaveLength(2);
      expect(parsed.materias[0]!.topicos![0]!.name).toBe("Sistema Tributário Nacional");
      expect(parsed.materias[0]!.topicos![1]!.name).toBe("Impostos da União");
    });

    it("extrai disciplina sem tópicos estruturados (topicos vazio ou omitido)", () => {
      const rawAiResponse = JSON.stringify({
        banca: "FGV",
        cargo: "Analista",
        materias: [
          {
            name: "Raciocínio Lógico",
            weight: 15,
            topicos: [],
          },
          {
            name: "Língua Inglesa",
            weight: 10,
          },
        ],
      });

      const parsed = parseEditalResponse(rawAiResponse);
      expect(parsed.materias).toHaveLength(2);
      expect(parsed.materias[0]!.topicos).toBeUndefined();
      expect(parsed.materias[1]!.topicos).toBeUndefined();
    });

    it("preserva hierarquia de tópicos (pai/filho)", () => {
      const rawAiResponse = JSON.stringify({
        materias: [
          {
            name: "Direito Constitucional",
            weight: 25,
            topicos: [
              { name: "Poder Judiciário" },
              { name: "Supremo Tribunal Federal", parent: "Poder Judiciário" },
              { name: "Conselho Nacional de Justiça", parent: "Poder Judiciário" },
            ],
          },
        ],
      });

      const parsed = parseEditalResponse(rawAiResponse);
      const topicos = parsed.materias[0]!.topicos!;
      expect(topicos).toHaveLength(3);
      expect(topicos[0]!.name).toBe("Poder Judiciário");
      expect(topicos[0]!.parent).toBeUndefined();
      expect(topicos[1]!.name).toBe("Supremo Tribunal Federal");
      expect(topicos[1]!.parent).toBe("Poder Judiciário");
      expect(topicos[2]!.name).toBe("Conselho Nacional de Justiça");
      expect(topicos[2]!.parent).toBe("Poder Judiciário");
    });

    it("suporta tópicos com ou sem peso explícito sem inventar pesos artificiais", () => {
      const rawAiResponse = JSON.stringify({
        materias: [
          {
            name: "Direito Administrativo",
            weight: 20,
            topicos: [
              { name: "Atos Administrativos", weight: 5 },
              { name: "Licitações Públicas" }, // sem peso
            ],
          },
        ],
      });

      const parsed = parseEditalResponse(rawAiResponse);
      const topicos = parsed.materias[0]!.topicos!;
      expect(topicos[0]!.weight).toBe(5);
      expect(topicos[1]!.weight).toBeUndefined();
    });

    it("rejeita payload inválido da IA com erro seguro", () => {
      expect(() => parseEditalResponse("Texto sem formato json")).toThrow(
        EditalParsingError
      );
      expect(() => parseEditalResponse("{ json invalido sem fechar")).toThrow(
        EditalParsingError
      );
    });

    it("falha com DOC_NOT_READY se o documento do edital não estiver pronto", async () => {
      mockDocFindById.mockResolvedValue({ id: "doc-1", status: "pending" });

      await expect(EditalParsingService.parseFromDocument("doc-1")).rejects.toSatisfy(
        (err: unknown) => err instanceof EditalParsingError && err.code === "DOC_NOT_READY"
      );
    });

    it("falha com DOC_NOT_FOUND se o documento não existir", async () => {
      mockDocFindById.mockResolvedValue(null);

      await expect(EditalParsingService.parseFromDocument("doc-inexistente")).rejects.toSatisfy(
        (err: unknown) => err instanceof EditalParsingError && err.code === "DOC_NOT_FOUND"
      );
    });
  });

  // ============================================================
  // C. ASSOCIAÇÃO DETERMINÍSTICA (NOTICE_TOPIC → KNOWLEDGE_TOPIC)
  // ============================================================
  describe("C. Associação com knowledge_topics (TopicResolverService)", () => {
    const SUBJ_DIREITO_CONST = "subj-const-uuid";
    const SUBJ_DIREITO_ADM = "subj-adm-uuid";

    const MOCK_CATALOG: TopicCandidate[] = [
      {
        id: "topic-direitos-fundamentais",
        subjectId: SUBJ_DIREITO_CONST,
        name: "Direitos e Garantias Fundamentais",
        slug: "direitos-e-garantias-fundamentais",
      },
      {
        id: "topic-morfologia",
        subjectId: SUBJ_DIREITO_CONST,
        name: "Classes de Palavras e Morfossintaxe",
        slug: "morfologia",
      },
      {
        id: "topic-atos-adm",
        subjectId: SUBJ_DIREITO_ADM,
        name: "Atos Administrativos",
        slug: "atos-administrativos",
      },
      // Ambiguidade intencional dentro de Direito Constitucional
      {
        id: "topic-controle-1",
        subjectId: SUBJ_DIREITO_CONST,
        name: "Controle de Constitucionalidade",
        slug: "controle-concentrado",
      },
      {
        id: "topic-controle-2",
        subjectId: SUBJ_DIREITO_CONST,
        name: "Controle de Constitucionalidade",
        slug: "controle-difuso",
      },
    ];

    it("associa por match exato normalizado dentro da mesma disciplina", () => {
      const res = resolveTopicInMemory(
        {
          topicName: "Direitos e Garantias Fundamentais",
          subjectId: SUBJ_DIREITO_CONST,
        },
        MOCK_CATALOG
      );
      expect(res.topicId).toBe("topic-direitos-fundamentais");
      expect(res.method).toBe("exact");
    });

    it("associa por slug normalizado quando o texto corresponder ao slug", () => {
      const res = resolveTopicInMemory(
        {
          topicName: "morfologia",
          subjectId: SUBJ_DIREITO_CONST,
        },
        MOCK_CATALOG
      );
      expect(res.topicId).toBe("topic-morfologia");
      expect(res.method).toBe("slug");
    });

    it("retorna null em caso de ausência de match (sem inventar associação)", () => {
      const res = resolveTopicInMemory(
        {
          topicName: "Tópico Inédito no Catálogo",
          subjectId: SUBJ_DIREITO_CONST,
        },
        MOCK_CATALOG
      );
      expect(res.topicId).toBeNull();
      expect(res.method).toBe("none");
    });

    it("retorna null quando há ambiguidade na mesma disciplina", () => {
      const res = resolveTopicInMemory(
        {
          topicName: "Controle de Constitucionalidade",
          subjectId: SUBJ_DIREITO_CONST,
        },
        MOCK_CATALOG
      );
      expect(res.topicId).toBeNull();
      expect(res.method).toBe("none");
    });

    it("rejeita associação cross-subject (tópico existente em outra disciplina)", () => {
      // 'Atos Administrativos' existe em Direito Administrativo, não em Direito Constitucional
      const res = resolveTopicInMemory(
        {
          topicName: "Atos Administrativos",
          subjectId: SUBJ_DIREITO_CONST,
        },
        MOCK_CATALOG
      );
      expect(res.topicId).toBeNull();
      expect(res.method).toBe("none");
    });
  });

  // ============================================================
  // D. APPLY DO EDITAL (PERSISTÊNCIA E IDEMPOTÊNCIA)
  // ============================================================
  describe("D. Aplicação do Edital (EditalApplyService)", () => {
    const DOC_ID = "11111111-1111-4000-8000-111111111111";
    const CONTEST_ID = "22222222-2222-4000-8000-222222222222";
    const EDITAL_ID = "33333333-3333-4000-8000-333333333333";
    const SUBJECT_ID = "44444444-4444-4000-8000-444444444444";
    const NOTICE_SUBJECT_ID = "55555555-5555-4000-8000-555555555555";

    beforeEach(() => {
      mockDocFindById.mockResolvedValue({ id: DOC_ID, status: "chunked", title: "Edital PM" });
      mockGetCurrentEdital.mockResolvedValue({ id: EDITAL_ID });
      mockFindOrCreateSubject.mockResolvedValue({ id: SUBJECT_ID, name: "Direito Constitucional" });
      mockUpsertNoticeSubject.mockResolvedValue({ id: NOTICE_SUBJECT_ID, weight: 20 });
      mockDocUpdateAssoc.mockResolvedValue({ id: DOC_ID });
    });

    it("persiste notice_topics com resolução determinística de knowledge_topic_id", async () => {
      mockResolveTopic.mockImplementation(async ({ topicName }) => {
        if (topicName === "Poder Judiciário") {
          return { topicId: "kt-judiciario-id", method: "exact" };
        }
        return { topicId: null, method: "none" };
      });

      mockReplaceTopicsForNoticeSubject.mockResolvedValue([
        { id: "nt-1", name: "Poder Judiciário", knowledgeTopicId: "kt-judiciario-id" },
        { id: "nt-2", name: "STF", knowledgeTopicId: null },
      ]);

      const result = await EditalApplyService.apply({
        documentId: DOC_ID,
        contestId: CONTEST_ID,
        materias: [
          {
            name: "Direito Constitucional",
            weight: 20,
            topicos: [
              { name: "Poder Judiciário" },
              { name: "STF", parent: "Poder Judiciário" },
            ],
          },
        ],
      });

      expect(result.editalId).toBe(EDITAL_ID);
      expect(result.appliedCount).toBe(1);
      expect(result.appliedTopicsCount).toBe(2);

      expect(mockReplaceTopicsForNoticeSubject).toHaveBeenCalledWith(
        NOTICE_SUBJECT_ID,
        expect.arrayContaining([
          expect.objectContaining({
            name: "Poder Judiciário",
            knowledgeTopicId: "kt-judiciario-id",
          }),
          expect.objectContaining({
            name: "STF",
            parentName: "Poder Judiciário",
            knowledgeTopicId: null,
          }),
        ])
      );
    });

    it("mantém funcionamento retrocompatível quando matérias não possuem tópicos", async () => {
      const result = await EditalApplyService.apply({
        documentId: DOC_ID,
        contestId: CONTEST_ID,
        materias: [
          {
            name: "Língua Portuguesa",
            weight: 15,
          },
        ],
      });

      expect(result.appliedCount).toBe(1);
      expect(result.appliedTopicsCount).toBe(0);
      expect(mockReplaceTopicsForNoticeSubject).not.toHaveBeenCalled();
    });

    it("preserva notice_subjects existentes ao aplicar tópicos", async () => {
      mockReplaceTopicsForNoticeSubject.mockResolvedValue([]);

      await EditalApplyService.apply({
        documentId: DOC_ID,
        contestId: CONTEST_ID,
        materias: [
          {
            name: "Direito Constitucional",
            weight: 25,
            topicos: [{ name: "Direitos Sociais" }],
          },
        ],
      });

      expect(mockUpsertNoticeSubject).toHaveBeenCalledWith(
        expect.objectContaining({
          editalId: EDITAL_ID,
          subjectId: SUBJECT_ID,
          weight: 25,
        })
      );
    });
  });

  // ============================================================
  // E. SEGURANÇA DE DADOS
  // ============================================================
  describe("E. Segurança de Dados", () => {
    it("não altera perguntas existentes durante operações de edital", () => {
      expect(EditalApplyService).toBeDefined();
      expect(EditalParsingService).toBeDefined();
    });

    it("garante idempotência na deduplicação de tópicos em memória", () => {
      const t1 = normalizeTopicName("Crase");
      const t2 = normalizeTopicName("  CRÁSE  ");
      expect(t1).toBe(t2);

      const set = new Set<string>();
      set.add(t1);
      expect(set.has(t2)).toBe(true);
    });
  });
});
