/**
 * POST /api/study/planner/generate
 *
 * Dispara o planejador adaptativo: recalcula prioridades e gera
 * o cronograma semanal com base no desempenho real do usuário.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { AdaptivePlannerService } from "@/lib/study/services/adaptive-planner.service";
import { PlannerGenerateRequestDtoSchema } from "@/lib/dto/study.dto";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = PlannerGenerateRequestDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await AdaptivePlannerService.generateWeekPlan({
      userId: session.user.id,
      startDate: parsed.data.start_date,
      activeDays: parsed.data.active_days,
    });

    return NextResponse.json({
      tasks_created: result.tasksCreated,
      priorities: result.priorities.map((p) => ({
        subject_id: p.subjectId,
        subject_name: p.subjectName,
        knowledge_subject_name: p.knowledgeSubjectName,
        link_method: p.linkMethod,
        priority: p.priority,
        performance: p.performance
          ? {
              total: p.performance.total,
              correct: p.performance.correct,
              accuracy_pct: p.performance.accuracyPct,
            }
          : null,
        factors: {
          accuracy_pct: p.factors.accuracyPct,
          total_questions: p.factors.totalQuestions,
          trend: p.factors.trend,
          days_since_last_task: p.factors.daysSinceLastTask,
          accuracy_score: p.factors.accuracyScore,
          volume_score: p.factors.volumeScore,
          trend_score: p.factors.trendScore,
          idle_score: p.factors.idleScore,
          banca_target: p.factors.bancaTarget,
          banca_relevance: p.factors.bancaRelevance,
          banca_score: p.factors.bancaScore,
        },
      })),
    });
  } catch (error) {
    console.error("[study/planner] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao gerar planejamento." },
      { status: 500 }
    );
  }
}
