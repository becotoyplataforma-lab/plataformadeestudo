/**
 * Testes do AdaptivePlannerService — planejador adaptativo determinístico.
 *
 * Cobrem:
 * - recalculatePriorities: prioridade alta/baixa, ajuste por tendência,
 *   disciplina sem vínculo com o catálogo.
 * - generateWeekPlan: distribuição por prioridade, dias ativos, persistência.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks de dependências ---
const mockListByUser = vi.fn();
const mockUpdateSubject = vi.fn();
const mockReplacePendingPlan = vi.fn();
const mockListTasks = vi.fn();
const mockListAttemptsBySubjectWindow = vi.fn();
const mockGetProfileMeta = vi.fn();
const mockGetPerformanceBySubject = vi.fn();
const mockResolveBatch = vi.fn();

vi.mock("../../repositories/study-subject.repository", () => ({
  StudySubjectRepository: {
    listByUser: (...a: unknown[]) => mockListByUser(...a),
    update: (...a: unknown[]) => mockUpdateSubject(...a),
  },
}));

vi.mock("../../repositories/study-task.repository", () => ({
  StudyTaskRepository: {
    replacePendingPlan: (...a: unknown[]) => mockReplacePendingPlan(...a),
  },
}));

vi.mock("@/lib/analytics/services/aggregation.service", () => ({
  AggregationService: {
    getPerformanceBySubject: (...a: unknown[]) => mockGetPerformanceBySubject(...a),
  },
}));

vi.mock("@/lib/analytics/repositories/aggregation.repository", () => ({
  AggregationRepository: {
    listTasks: (...a: unknown[]) => mockListTasks(...a),
    listAttemptsBySubjectWindow: (...a: unknown[]) =>
      mockListAttemptsBySubjectWindow(...a),
    getProfileMeta: (...a: unknown[]) => mockGetProfileMeta(...a),
  },
}));

vi.mock("../link-resolver.service", () => ({
  LinkResolverService: {
    resolveBatch: (...a: unknown[]) => mockResolveBatch(...a),
  },
}));

import { AdaptivePlannerService } from "../adaptive-planner.service";

// --- Fixtures ---
const SUBJECT = {
  id: "s1",
  userId: "u1",
  name: "Português",
  color: "#0ea5e9",
  priority: 3,
  cargaHorariaTotal: 50,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  deletedAt: null,
};

const KS = {
  id: "ks1",
  name: "Português",
  slug: "portugues",
  description: null,
  color: "#0ea5e9",
  keywords: [],
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  deletedAt: null,
};

const exactLink = { knowledgeSubject: KS, method: "exact" as const };
const noneLink = { knowledgeSubject: null, method: "none" as const };

function perf(
  over: Partial<{ subjectId: string; subjectName: string; total: number; correct: number; accuracyPct: number }> = {}
) {
  return {
    subjectId: "ks1",
    subjectName: "Português",
    total: 10,
    correct: 9,
    accuracyPct: 90,
    ...over,
  };
}

describe("AdaptivePlannerService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("recalculatePriorities", () => {
    it("retorna lista vazia quando o usuário não tem disciplinas", async () => {
      mockListByUser.mockResolvedValue([]);

      const result = await AdaptivePlannerService.recalculatePriorities("u1");

      expect(result).toEqual([]);
      expect(mockResolveBatch).not.toHaveBeenCalled();
    });

    it("dá prioridade baixa para bom desempenho, estudo recente e tendência estável", async () => {
      mockListByUser.mockResolvedValue([SUBJECT]);
      mockResolveBatch.mockResolvedValue(new Map([["Português", exactLink]]));
      mockGetPerformanceBySubject.mockResolvedValue([perf()]); // 90% acerto
      mockListTasks.mockResolvedValue([
        {
          scheduledDate: new Date(),
          status: "concluida",
          durationMin: 30,
          completedAt: new Date(),
        },
      ]);
      // tendência estável: recente 80% vs antigo 80% → sem delta
      mockListAttemptsBySubjectWindow
        .mockResolvedValueOnce({ total: 5, correct: 4 })
        .mockResolvedValueOnce({ total: 5, correct: 4 });

      const result = await AdaptivePlannerService.recalculatePriorities("u1");

      expect(result).toHaveLength(1);
      expect(result[0]!.priority).toBe(1);
      expect(result[0]!.linkMethod).toBe("exact");
      expect(result[0]!.factors.accuracyPct).toBe(90);
      expect(mockUpdateSubject).toHaveBeenCalledWith(
        "s1",
        "u1",
        expect.objectContaining({ priority: 1 })
      );
    });

    it("aumenta a prioridade quando o desempenho caiu (tendência down)", async () => {
      mockListByUser.mockResolvedValue([SUBJECT]);
      mockResolveBatch.mockResolvedValue(new Map([["Português", exactLink]]));
      // 47.5% de acerto — prioridade base 2
      mockGetPerformanceBySubject.mockResolvedValue([perf({ total: 40, correct: 19, accuracyPct: 47.5 })]);
      mockListTasks.mockResolvedValue([]); // idle 999 → contribui 2
      // tendência down: recente 40% vs antigo 80%
      mockListAttemptsBySubjectWindow
        .mockResolvedValueOnce({ total: 5, correct: 2 })
        .mockResolvedValueOnce({ total: 5, correct: 4 });

      const result = await AdaptivePlannerService.recalculatePriorities("u1");

      expect(result[0]!.factors.trend).toBe("down");
      expect(result[0]!.priority).toBe(3); // 2 base + 1 por tendência
      expect(mockUpdateSubject).toHaveBeenCalledWith(
        "s1",
        "u1",
        expect.objectContaining({ priority: 3 })
      );
    });

    it("lida com disciplina sem vínculo no catálogo (linkMethod none)", async () => {
      mockListByUser.mockResolvedValue([{ ...SUBJECT, name: "Matéria Livre" }]);
      mockResolveBatch.mockResolvedValue(new Map([["Matéria Livre", noneLink]]));
      mockGetPerformanceBySubject.mockResolvedValue([]);
      mockListTasks.mockResolvedValue([]);

      const result = await AdaptivePlannerService.recalculatePriorities("u1");

      expect(result[0]!.linkMethod).toBe("none");
      expect(result[0]!.knowledgeSubjectName).toBeNull();
      expect(result[0]!.performance).toBeNull();
      expect(result[0]!.factors.accuracyPct).toBeNull();
    });
  });

  describe("generateWeekPlan", () => {
    it("gera tarefas e persiste substituindo o plano (replacePendingPlan)", async () => {
      const matematica = {
        ...SUBJECT,
        id: "s2",
        name: "Matemática",
        color: "#14b8a6",
      };
      const ksMatematica = { ...KS, id: "ks2", name: "Matemática", slug: "matematica" };

      mockListByUser.mockResolvedValue([SUBJECT, matematica]);
      mockResolveBatch.mockResolvedValue(
        new Map([
          ["Português", { knowledgeSubject: KS, method: "exact" as const }],
          ["Matemática", { knowledgeSubject: ksMatematica, method: "exact" as const }],
        ])
      );
      // Português 90% (prioridade baixa), Matemática 20% (prioridade alta)
      mockGetPerformanceBySubject.mockResolvedValue([
        perf({ subjectId: "ks2", subjectName: "Matemática", total: 10, correct: 2, accuracyPct: 20 }),
        perf(),
      ]);
      mockListTasks.mockResolvedValue([]);
      // tendência estável para ambas
      mockListAttemptsBySubjectWindow
        .mockResolvedValue({ total: 5, correct: 4 });
      mockGetProfileMeta.mockResolvedValue({ metaDiariaMin: 120 });
      mockReplacePendingPlan.mockImplementation(
        (_userId: string, rows: unknown[]) => rows
      );

      const result = await AdaptivePlannerService.generateWeekPlan({
        userId: "u1",
        startDate: "2026-08-17",
      });

      // 2 disciplinas × 5 dias úteis = 10 tarefas
      expect(result.tasksCreated).toBe(10);
      expect(result.tasks).toHaveLength(10);
      // Replanejar SUBSTITUI o plano (remove pendentes antigas e insere novas)
      expect(mockReplacePendingPlan).toHaveBeenCalledTimes(1);
      const [calledUserId, inserted] = mockReplacePendingPlan.mock.calls[0]! as [
        string,
        Array<{
          studySubjectId: string;
          durationMin: number;
          scheduledDate: Date;
          status: string;
        }>
      ];
      expect(calledUserId).toBe("u1");
      expect(inserted).toHaveLength(10);
      for (const row of inserted) {
        expect(row.studySubjectId).toMatch(/^s[12]$/);
        expect(row.durationMin).toBeGreaterThan(0);
        expect(row.scheduledDate).toBeInstanceOf(Date);
        expect(row.status).toBe("pendente");
      }
    });

    it("respeita os dias ativos informados", async () => {
      const matematica = { ...SUBJECT, id: "s2", name: "Matemática", color: "#14b8a6" };
      const ksMatematica = { ...KS, id: "ks2", name: "Matemática", slug: "matematica" };

      mockListByUser.mockResolvedValue([SUBJECT, matematica]);
      mockResolveBatch.mockResolvedValue(
        new Map([
          ["Português", { knowledgeSubject: KS, method: "exact" as const }],
          ["Matemática", { knowledgeSubject: ksMatematica, method: "exact" as const }],
        ])
      );
      mockGetPerformanceBySubject.mockResolvedValue([
        perf({ subjectId: "ks2", subjectName: "Matemática", total: 10, correct: 2, accuracyPct: 20 }),
        perf(),
      ]);
      mockListTasks.mockResolvedValue([]);
      mockListAttemptsBySubjectWindow.mockResolvedValue({ total: 5, correct: 4 });
      mockGetProfileMeta.mockResolvedValue({ metaDiariaMin: 120 });
      mockReplacePendingPlan.mockImplementation(
        (_userId: string, rows: unknown[]) => rows
      );

      const result = await AdaptivePlannerService.generateWeekPlan({
        userId: "u1",
        startDate: "2026-08-17",
        activeDays: [1, 3, 5], // 3 dias
      });

      // 2 disciplinas × 3 dias = 6 tarefas
      expect(result.tasksCreated).toBe(6);
    });

    it("replanejar não acumula: substitui pendentes antigas e insere as novas (25 → 25, nunca 50)", async () => {
      const matematica = { ...SUBJECT, id: "s2", name: "Matemática", color: "#14b8a6" };
      const ksMatematica = { ...KS, id: "ks2", name: "Matemática", slug: "matematica" };

      mockListByUser.mockResolvedValue([SUBJECT, matematica]);
      mockResolveBatch.mockResolvedValue(
        new Map([
          ["Português", { knowledgeSubject: KS, method: "exact" as const }],
          ["Matemática", { knowledgeSubject: ksMatematica, method: "exact" as const }],
        ])
      );
      mockGetPerformanceBySubject.mockResolvedValue([
        perf({ subjectId: "ks2", subjectName: "Matemática", total: 10, correct: 2, accuracyPct: 20 }),
        perf(),
      ]);
      mockListTasks.mockResolvedValue([]);
      mockListAttemptsBySubjectWindow.mockResolvedValue({ total: 5, correct: 4 });
      mockGetProfileMeta.mockResolvedValue({ metaDiariaMin: 120 });

      // Simula um replan anterior que deixou 25 tarefas pendentes no banco.
      // O service NÃO faz append: delega a substituição ao repositório,
      // que remove as pendentes antigas antes de inserir as novas.
      mockReplacePendingPlan.mockResolvedValue([] as unknown[]);

      const result = await AdaptivePlannerService.generateWeekPlan({
        userId: "u1",
        startDate: "2026-08-17",
      });

      expect(result.tasksCreated).toBe(10);
      // Chamado UMA vez, SEMPRE com o userId escopado — nunca createBatch/append.
      expect(mockReplacePendingPlan).toHaveBeenCalledTimes(1);
      const [calledUserId, rows] = mockReplacePendingPlan.mock.calls[0]! as [
        string,
        unknown[]
      ];
      expect(calledUserId).toBe("u1");
      expect(rows).toHaveLength(10);
      // Garante que NÃO existe mais chamada de persistência (sem duplicação).
      expect(mockReplacePendingPlan).toHaveBeenCalledWith("u1", expect.any(Array));
    });

    it("não gera persistência quando não há tarefas suficientes (nenhuma substituição)", async () => {
      mockListByUser.mockResolvedValue([{ ...SUBJECT, priority: 1 }]);
      mockResolveBatch.mockResolvedValue(new Map([["Português", exactLink]]));
      mockGetPerformanceBySubject.mockResolvedValue([perf()]); // 90% → prioridade baixa
      mockListTasks.mockResolvedValue([]);
      mockListAttemptsBySubjectWindow.mockResolvedValue({ total: 5, correct: 4 });
      // Meta mínima + apenas domingo ativo → 10min/semana < 15min mínimo → 0 tarefas
      mockGetProfileMeta.mockResolvedValue({ metaDiariaMin: 10 });

      const result = await AdaptivePlannerService.generateWeekPlan({
        userId: "u1",
        startDate: "2026-08-17",
        activeDays: [0],
      });

      expect(mockReplacePendingPlan).not.toHaveBeenCalled();
      expect(result.tasksCreated).toBe(0);
    });
  });
});
