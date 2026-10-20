import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { apiError, apiOk } from "@/lib/api/helpers";
import { answerQuestionSchema } from "@/lib/validations/questoes";
import { getGabarito, getQuestionWithOptions } from "@/lib/db/repositories/questoes";
import { QuestionAttemptRepository } from "@/lib/study/repositories";
<<<<<<< HEAD
import { DEMO_QUESTIONS } from "@/lib/constants/demo-questoes";
=======
import { resolveUserLimits } from "@/lib/billing/services/limits.resolver";
import { DEFAULT_FREE_LIMITS } from "@/lib/billing/types";
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6

/**
 * POST /api/questoes/:id/responder
 * Registra uma tentativa e retorna o gabarito com explicação.
 * Suporta modo convidado e questões de demonstração.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? "00000000-0000-4000-8000-000000000001";

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = answerQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, parsed.error.issues[0]?.message ?? "Dados inválidos.");
    }

<<<<<<< HEAD
    const normalizedSelected = parsed.data.selected_letter.trim().toUpperCase();

    // Se for uma questão de demonstração
    const demoQ = DEMO_QUESTIONS.find((q) => q.id === id);
    if (demoQ) {
      const correct = demoQ.gabarito.trim().toUpperCase() === normalizedSelected;
      return apiOk({
        correct,
        gabarito: demoQ.gabarito,
        explicacao: demoQ.explicacao,
        acertos_acumulados: correct ? 1 : 0,
      });
    }

    try {
      const db = await createClient();

      // Verifica se a questão existe e é pública
      const question = await getQuestionWithOptions(id);
      if (!question || !question.is_public) {
        return apiError(404, "Questão não encontrada.");
      }
=======
    // Verifica se a questão existe e é pública
    const question = await getQuestionWithOptions(id);
    if (!question || !question.is_public) {
      return apiError(404, "Questão não encontrada.");
    }

    const gabarito = await getGabarito(id);
    const correct = gabarito?.gabarito === parsed.data.selected_letter;

    // --- Cota diária de questões (Billing: maxQuestionsPerDay, best-effort) ---
    const limits = await resolveUserLimits(session.user.id);
    const maxQuestionsPerDay =
      limits.maxQuestionsPerDay ?? DEFAULT_FREE_LIMITS.maxQuestionsPerDay ?? 20;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    const current = await QuestionAttemptRepository.countToday(
      session.user.id,
      start,
      end
    );
    if (current >= maxQuestionsPerDay) {
      return NextResponse.json(
        {
          error: "QUOTA_EXCEEDED",
          message: `Você atingiu o limite diário de questões do seu plano (${maxQuestionsPerDay}/dia). Tente novamente amanhã ou faça upgrade.`,
          resource: "questions",
          limit: maxQuestionsPerDay,
          current,
          resetAt: end.toISOString(),
        },
        { status: 429 }
      );
    }

    await QuestionAttemptRepository.create({
      userId: session.user.id,
      questionId: id,
      selectedLetter: parsed.data.selected_letter,
      isCorrect: correct,
      timeSpentSec: parsed.data.time_spent_sec,
      mode: parsed.data.mode,
    });
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6

      const gabarito = await getGabarito(id);
      const correct = gabarito?.gabarito?.trim().toUpperCase() === normalizedSelected;

      try {
        await QuestionAttemptRepository.create({
          userId,
          questionId: id,
          selectedLetter: normalizedSelected,
          isCorrect: correct,
          timeSpentSec: parsed.data.time_spent_sec,
          mode: parsed.data.mode,
        });
      } catch {
        // Ignora erro de gravação se banco de métricas estiver offline
      }

      let count = 0;
      try {
        count = (await QuestionAttemptRepository.countCorrectByUser(userId)) ?? 0;
      } catch {
        count = correct ? 1 : 0;
      }

      return apiOk({
        correct,
        gabarito: gabarito?.gabarito ?? null,
        explicacao: gabarito?.explicacao ?? null,
        acertos_acumulados: count,
      });
    } catch {
      // Se banco estiver offline, retorna fallback
      return apiOk({
        correct: false,
        gabarito: null,
        explicacao: null,
        acertos_acumulados: 0,
      });
    }
  } catch (error) {
    console.error("[questoes] respond", error);
    return apiError(500, "Erro interno.");
  }
}
