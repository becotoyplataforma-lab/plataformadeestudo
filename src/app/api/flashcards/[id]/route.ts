import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/helpers";
import { deleteFlashcard } from "@/lib/db/repositories/flashcards";

/** DELETE /api/flashcards/:id — remove flashcard do usuário */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");

    const { id } = await params;
    const db = await createClient();
    await deleteFlashcard(db, session.user.id, id);
    return apiOk({ ok: true });
  } catch (error) {
    console.error("[flashcards] DELETE", error);
    return apiError(500, "Erro interno.");
  }
}
