import { auth } from "@/lib/auth/auth";
import { apiError, apiOk } from "@/lib/api/helpers";
import { reviewSchema } from "@/lib/validations/flashcards";
import { countDue, recordReview } from "@/lib/db/repositories/flashcards";
import { ReviewScheduleError } from "@/lib/study/services/review-schedule.service";

/** POST /api/flashcards/review — registra revisão SRS */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");

    const body = await req.json().catch(() => null);
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, parsed.error.issues[0]?.message ?? "Dados inválidos.");
    }

    const result = await recordReview(session.user.id, parsed.data);
    const remaining = await countDue(session.user.id);

    return apiOk({ ...result, due_today_left: remaining });
  } catch (error) {
    if (error instanceof ReviewScheduleError) {
      return apiError(404, error.message);
    }
    console.error("[flashcards] review", error);
    return apiError(500, "Erro interno.");
  }
}
