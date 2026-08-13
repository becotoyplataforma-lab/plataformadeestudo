import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/helpers";
import { listSessions, createSession } from "@/lib/db/repositories/chat";

/** GET /api/chat/sessions — lista conversas do usuário */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");
    const db = await createClient();
    const data = await listSessions(db, session.user.id);
    return apiOk({ data });
  } catch (error) {
    console.error("[chat/sessions] GET", error);
    return apiError(500, "Erro interno.");
  }
}

/** POST /api/chat/sessions — cria nova conversa */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");

    const body = await req.json().catch(() => ({}));
    const db = await createClient();
    // "muse" é provider extra; a coluna model é enum ai_model (flash/pro) —
    // sem migration, persiste como "pro" (a chamada real usa o provider Muse).
    const model = body.model === "muse" ? "pro" : body.model ?? "flash";
    const data = await createSession(db, session.user.id, {
      title: body.title ?? "Nova conversa",
      subject_id: body.subject_id ?? null,
      model,
    });
    return apiOk({ data }, 201);
  } catch (error) {
    console.error("[chat/sessions] POST", error);
    return apiError(500, "Erro interno.");
  }
}
