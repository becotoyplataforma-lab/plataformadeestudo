import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/helpers";
import { listTasks } from "@/lib/db/repositories/cronograma";

/** GET /api/cronograma/tarefas — lista tarefas do usuário */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");

    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;

    const db = await createClient();
    const data = await listTasks(db, session.user.id, from, to);
    return apiOk({ data });
  } catch (error) {
    console.error("[cronograma] GET", error);
    return apiError(500, "Erro interno.");
  }
}
