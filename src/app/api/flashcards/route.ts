import { auth } from "@/lib/auth/auth";
import { apiError, apiOk } from "@/lib/api/helpers";
import { createFlashcardSchema } from "@/lib/validations/flashcards";
import { createFlashcard, listFlashcards } from "@/lib/db/repositories/flashcards";
import { FlashcardError } from "@/lib/study/services/flashcard.service";

/** GET /api/flashcards — lista flashcards do usuário */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");

    const url = new URL(req.url);
    const subjectId = url.searchParams.get("subject_id") ?? undefined;
    const onlyDue = url.searchParams.get("onlyDue") === "true";

    const data = await listFlashcards(session.user.id, {
      subject_id: subjectId,
      onlyDue,
    });
    return apiOk({ data });
  } catch (error) {
    console.error("[flashcards] GET", error);
    return apiError(500, "Erro interno.");
  }
}

/** POST /api/flashcards — cria novo flashcard */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");

    const body = await req.json().catch(() => null);
    const parsed = createFlashcardSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, parsed.error.issues[0]?.message ?? "Dados inválidos.");
    }

    const data = await createFlashcard(session.user.id, parsed.data);
    return apiOk({ data }, 201);
  } catch (error) {
    if (error instanceof FlashcardError) {
      return apiError(error.code === "SUBJECT_NOT_FOUND" ? 404 : 422, error.message);
    }
    console.error("[flashcards] POST", error);
    return apiError(500, "Erro interno.");
  }
}
