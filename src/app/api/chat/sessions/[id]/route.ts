import { auth } from "@/lib/auth/auth";
import { apiError, apiOk } from "@/lib/api/helpers";
import { deleteSession, getSession } from "@/lib/db/repositories/chat";

/** DELETE /api/chat/sessions/:id — exclui conversa */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");
    const { id } = await params;

    const existing = await getSession(session.user.id, id);
    if (!existing) return apiError(404, "Conversa não encontrada.");

    await deleteSession(session.user.id, id);
    return apiOk({ ok: true });
  } catch (error) {
    console.error("[chat/sessions] DELETE", error);
    return apiError(500, "Erro interno.");
  }
}
