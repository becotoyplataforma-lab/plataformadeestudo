import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/helpers";
import { listMessages } from "@/lib/db/repositories/chat";

/** GET /api/chat/sessions/:id/messages — histórico da conversa */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");
    const { id } = await params;

    const db = await createClient();
    const data = await listMessages(db, session.user.id, id);
    return apiOk({ data });
  } catch (error) {
    console.error("[chat/messages] GET", error);
    return apiError(500, "Erro interno.");
  }
}
