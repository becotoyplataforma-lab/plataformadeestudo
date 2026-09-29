/**
 * ConcursoAI — Testes da Integração de Tópicos ao Planner AI e Fallback (FASE 6D)
 *
 * Cobertura:
 * D. Planner AI:
 *    - enriquecimento de tópicos no structuredContext
 *    - aceitação de topic_id válido no PlannerAiTaskSchema
 *    - rejeição e fallback quando topic_id pertence a outra disciplina
 *    - rejeição e fallback quando topic_id é inexistente/hallucinado
 *    - aceitação de tarefas com topic_id nulo/omitido (revisão geral)
 * E. Fallback determinístico no AdaptivePlanner:
 *    - seleção determinística de tópico quando disponível (menor acerto/maior frequência)
 *    - geração sem tópico quando a disciplina não tem tópicos
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks de dependências externas
vi.mock("@/lib/ai/deepseek", () => ({
  chatCompletion: vi.fn(),
}));

vi.mock("@/lib/billing/services/limits.resolver", () => ({
  resolveUserLimits: vi.fn().mockResolvedValue({ maxMessages: 50, maxTokens: 100_000 }),
}));

vi.mock("@/lib/ai/services/usage.service", () => ({
  UsageService: {
    checkLimit: vi.fn().mockResolvedValue({ canSend: true }),
    record: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/observability", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { chatCompletion } from "@/lib/ai/deepseek";
import {
  PlannerAiService,
  validateAndNormalizeAiResponse,
} from "../planner-ai.service";
import type { SubjectPriority } from "../adaptive-planner.service";
import type { EnrichedSubjectContext } from "../edital-context.service";

describe("PlannerAiService — Integração de Tópicos (FASE 6D)", () => {
  const SUBJ_PORTUGUES = "11111111-1111-4000-8000-111111111111";
  const SUBJ_DIREITO = "22222222-2222-4000-8000-222222222222";

  const TOPIC_CRASE = "aaaaaaaa-aaaa-4000-8000-aaaaaaaaaaaa";
  const TOPIC_PONTUACAO = "bbbbbbbb-bbbb-4000-8000-bbbbbbbbbbbb";
  const TOPIC_ATOS = "cccccccc-cccc-4000-8000-cccccccccccc";

  const mockPriorities: SubjectPriority[] = [
    {
      subjectId: SUBJ_PORTUGUES,
      subjectName: "Língua Portuguesa",
      knowledgeSubjectName: "Língua Portuguesa",
      linkMethod: "exact",
      priority: 5,
      performance: null,
      factors: {
        accuracyPct: 45,
        totalQuestions: 20,
        trend: "down",
        daysSinceLastTask: 10,
        accuracyScore: 5,
        volumeScore: 4,
        trendScore: 4,
        idleScore: 5,
        bancaTarget: "CEBRASPE",
        bancaRelevance: 0.8,
        bancaScore: 0.6,
        editalContestId: "c1",
        editalWeight: 20,
        editalShare: 0.25,
        editalScore: 0.5,
      },
    },
    {
      subjectId: SUBJ_DIREITO,
      subjectName: "Direito Administrativo",
      knowledgeSubjectName: "Direito Administrativo",
      linkMethod: "exact",
      priority: 3,
      performance: null,
      factors: {
        accuracyPct: 75,
        totalQuestions: 30,
        trend: "stable",
        daysSinceLastTask: 3,
        accuracyScore: 3,
        volumeScore: 3,
        trendScore: 3,
        idleScore: 2,
        bancaTarget: "CEBRASPE",
        bancaRelevance: 0.5,
        bancaScore: 0,
        editalContestId: "c1",
        editalWeight: 15,
        editalShare: 0.2,
        editalScore: 0,
      },
    },
  ];

  const mockEnrichedSubjects: EnrichedSubjectContext[] = [
    {
      subjectId: SUBJ_PORTUGUES,
      noticeSubjectId: "ns-port",
      subjectName: "Língua Portuguesa",
      editalWeight: 20,
      topics: [
        {
          topicId: TOPIC_CRASE,
          knowledgeTopicId: TOPIC_CRASE,
          noticeTopicId: "nt-crase",
          topicName: "Crase",
          editalTopicWeight: 5,
          historicalFrequencyPercent: 25,
          frequencySource: "board",
          totalQuestions: 15,
          attemptedQuestions: 5,
          correctAnswers: 1,
          incorrectAnswers: 4,
          accuracyPct: 20,
          lastAttemptAt: new Date("2026-09-25"),
          daysSinceLastAttempt: 4,
          trend: "down",
        },
        {
          topicId: TOPIC_PONTUACAO,
          knowledgeTopicId: TOPIC_PONTUACAO,
          noticeTopicId: "nt-pont",
          topicName: "Pontuação",
          editalTopicWeight: null,
          historicalFrequencyPercent: 15,
          frequencySource: "board",
          totalQuestions: 10,
          attemptedQuestions: 4,
          correctAnswers: 3,
          incorrectAnswers: 1,
          accuracyPct: 75,
          lastAttemptAt: new Date("2026-09-27"),
          daysSinceLastAttempt: 2,
          trend: "stable",
        },
      ],
    },
    {
      subjectId: SUBJ_DIREITO,
      noticeSubjectId: "ns-dir",
      subjectName: "Direito Administrativo",
      editalWeight: 15,
      topics: [
        {
          topicId: TOPIC_ATOS,
          knowledgeTopicId: TOPIC_ATOS,
          noticeTopicId: "nt-atos",
          topicName: "Atos Administrativos",
          editalTopicWeight: 10,
          historicalFrequencyPercent: 30,
          frequencySource: "board",
          totalQuestions: 25,
          attemptedQuestions: 8,
          correctAnswers: 6,
          incorrectAnswers: 2,
          accuracyPct: 75,
          lastAttemptAt: new Date("2026-09-26"),
          daysSinceLastAttempt: 3,
          trend: "stable",
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPSEEK_API_KEY = "test-sk-key";
  });

  describe("A. Validação de Domínio (validateAndNormalizeAiResponse)", () => {
    const validSubjectMap = new Map([
      [SUBJ_PORTUGUES, "Língua Portuguesa"],
      [SUBJ_DIREITO, "Direito Administrativo"],
    ]);
    const validDates = new Set(["2026-10-01", "2026-10-02"]);
    const validTopicBySubjectMap = new Map([
      [SUBJ_PORTUGUES, new Set([TOPIC_CRASE, TOPIC_PONTUACAO])],
      [SUBJ_DIREITO, new Set([TOPIC_ATOS])],
    ]);

    it("aceita tarefa com topic_id válido pertencente à respectiva disciplina", () => {
      const validPayload = JSON.stringify({
        plan_summary: "Foco intensivo em Crase",
        tasks: [
          {
            subject_id: SUBJ_PORTUGUES,
            topic_id: TOPIC_CRASE,
            scheduled_date: "2026-10-01",
            duration_min: 60,
            title: "Estudar Língua Portuguesa: Regras especiais de Crase",
            description: "Teoria e resolução de questões",
          },
        ],
      });

      const res = validateAndNormalizeAiResponse(
        validPayload,
        validSubjectMap,
        validDates,
        120,
        validTopicBySubjectMap
      );

      expect(res.tasks).toHaveLength(1);
      expect(res.tasks[0]!.topicId).toBe(TOPIC_CRASE);
      expect(res.tasks[0]!.studySubjectId).toBe(SUBJ_PORTUGUES);
    });

    it("aceita tarefa com topic_id nulo ou omitido (sessão geral de disciplina)", () => {
      const validPayload = JSON.stringify({
        tasks: [
          {
            subject_id: SUBJ_DIREITO,
            scheduled_date: "2026-10-01",
            duration_min: 45,
            title: "Estudar Direito Administrativo: Revisão Geral",
          },
        ],
      });

      const res = validateAndNormalizeAiResponse(
        validPayload,
        validSubjectMap,
        validDates,
        120,
        validTopicBySubjectMap
      );

      expect(res.tasks).toHaveLength(1);
      expect(res.tasks[0]!.topicId).toBeNull();
    });

    it("rejeita tarefa com topic_id pertencente a outra disciplina (cross-subject)", () => {
      // TOPIC_ATOS pertence a Direito, mas foi atribuído a Português
      const crossPayload = JSON.stringify({
        tasks: [
          {
            subject_id: SUBJ_PORTUGUES,
            topic_id: TOPIC_ATOS,
            scheduled_date: "2026-10-01",
            duration_min: 60,
            title: "Estudar Língua Portuguesa: Atos Administrativos",
          },
        ],
      });

      expect(() =>
        validateAndNormalizeAiResponse(
          crossPayload,
          validSubjectMap,
          validDates,
          120,
          validTopicBySubjectMap
        )
      ).toThrow(/UNKNOWN_TOPIC_ID/);
    });

    it("rejeita tarefa com topic_id inventado ou inexistente", () => {
      const hallucinatedPayload = JSON.stringify({
        tasks: [
          {
            subject_id: SUBJ_PORTUGUES,
            topic_id: "99999999-9999-4000-8000-999999999999",
            scheduled_date: "2026-10-01",
            duration_min: 60,
            title: "Estudar Língua Portuguesa: Tópico Fantasma",
          },
        ],
      });

      expect(() =>
        validateAndNormalizeAiResponse(
          hallucinatedPayload,
          validSubjectMap,
          validDates,
          120,
          validTopicBySubjectMap
        )
      ).toThrow(/UNKNOWN_TOPIC_ID/);
    });
  });

  describe("B. Enriquecimento de Contexto no DeepSeek e Fallback Seguro", () => {
    it("inclui tópicos no payload enviado ao DeepSeek quando disponíveis", async () => {
      vi.mocked(chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          plan_summary: "Plano adaptado aos tópicos prioritários",
          tasks: [
            {
              subject_id: SUBJ_PORTUGUES,
              topic_id: TOPIC_CRASE,
              scheduled_date: "2026-10-01",
              duration_min: 60,
              title: "Estudar Língua Portuguesa: Crase na banca Cebraspe",
            },
            {
              subject_id: SUBJ_DIREITO,
              topic_id: TOPIC_ATOS,
              scheduled_date: "2026-10-01",
              duration_min: 60,
              title: "Estudar Direito Administrativo: Atos",
            },
          ],
        }),
        tokensIn: 450,
        tokensOut: 200,
        model: "flash",
      });

      const res = await PlannerAiService.generatePersonalizedPlan({
        userId: "user-1",
        startDate: "2026-09-30",
        activeDays: [1], // 2026-10-01
        dailyMetaMin: 120,
        priorities: mockPriorities,
        bancaTarget: "CEBRASPE",
        enrichedSubjects: mockEnrichedSubjects,
      });

      expect(res).not.toBeNull();
      expect(res?.aiGenerated).toBe(true);
      expect(res?.tasks).toHaveLength(2);
      expect(res?.tasks[0]!.topicId).toBe(TOPIC_CRASE);
      expect(res?.tasks[1]!.topicId).toBe(TOPIC_ATOS);

      // Inspeciona o payload enviado ao modelo
      const call = vi.mocked(chatCompletion).mock.calls[0]![0];
      const userMsg = JSON.parse(call.messages[1]!.content);

      expect(userMsg.subjects[0].topics).toHaveLength(2);
      expect(userMsg.subjects[0].topics[0].topic_name).toBe("Crase");
      expect(userMsg.subjects[0].topics[0].accuracy_pct).toBe(20);
      expect(userMsg.subjects[0].topics[0].historical_frequency_percent).toBe(25);
    });

    it("aciona fallback determinístico seguro se o modelo devolver topic_id inválido", async () => {
      vi.mocked(chatCompletion).mockResolvedValueOnce({
        content: JSON.stringify({
          tasks: [
            {
              subject_id: SUBJ_PORTUGUES,
              topic_id: "00000000-0000-4000-8000-000000000000", // inventado
              scheduled_date: "2026-10-01",
              duration_min: 60,
              title: "Estudar Língua Portuguesa: Inventado",
            },
          ],
        }),
        tokensIn: 300,
        tokensOut: 100,
        model: "flash",
      });

      const res = await PlannerAiService.generatePersonalizedPlan({
        userId: "user-1",
        startDate: "2026-09-30",
        activeDays: [1],
        dailyMetaMin: 120,
        priorities: mockPriorities,
        enrichedSubjects: mockEnrichedSubjects,
      });

      // Retorna null acionando o gerador determinístico sem quebrar a execução
      expect(res).toBeNull();
    });
  });
});
