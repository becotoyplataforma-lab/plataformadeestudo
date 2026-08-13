import { auth } from "@/lib/auth/auth";
import { apiError, apiOk } from "@/lib/api/helpers";
import { deleteFlashcard } from "@/lib/db/repositories/flashcards";
import { FlashcardError } from "@/lib/study/services/flashcard.service";

/** DELETE /api/flashcards/:id — remove flashcard do usuário */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");

    const { id } = await params;
    await deleteFlashcard(session.user.id, id);
    return apiOk({ ok: true });
  } catch (error) {
    if (error instanceof FlashcardError) {
      return apiError(404, error.message);
    }
    console.error("[flashcards] DELETE", error);
    return apiError(500, "Erro interno.");
  }
}
