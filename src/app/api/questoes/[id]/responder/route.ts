import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/helpers";
import { answerQuestionSchema } from "@/lib/validations/questoes";
import { getGabarito, getQuestionWithOptions } from "@/lib/db/repositories/questoes";
import { QuestionAttemptRepository } from "@/lib/study/repositories";

/**
 * POST /api/questoes/:id/responder
 * Registra uma tentativa e retorna o gabarito com explicação.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = answerQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, parsed.error.issues[0]?.message ?? "Dados inválidos.");
    }

    const db = await createClient();

    // Verifica se a questão existe e é pública
    const question = await getQuestionWithOptions(db, id);
    if (!question || !question.is_public) {
      return apiError(404, "Questão não encontrada.");
    }

    const gabarito = await getGabarito(db, id);
    const correct = gabarito?.gabarito === parsed.data.selected_letter;

    await QuestionAttemptRepository.create({
      userId: session.user.id,
      questionId: id,
      selectedLetter: parsed.data.selected_letter,
      isCorrect: correct,
      timeSpentSec: parsed.data.time_spent_sec,
      mode: parsed.data.mode,
    });

    // Total de acertos do usuário (para feedback)
    const count = await QuestionAttemptRepository.countCorrectByUser(session.user.id);

    return apiOk({
      correct,
      gabarito: gabarito?.gabarito ?? null,
      explicacao: gabarito?.explicacao ?? null,
      acertos_acumulados: count ?? 0,
    });
  } catch (error) {
    console.error("[questoes] respond", error);
    return apiError(500, "Erro interno.");
  }
}
