import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/helpers";
import { getPerformanceBySubject } from "@/lib/db/repositories/analises";

/** GET /api/analises/por-materia — acerto por matéria */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");
    const db = await createClient();
    const data = await getPerformanceBySubject(db, session.user.id);
    return apiOk({ data });
  } catch (error) {
    console.error("[analises] por-materia", error);
    return apiError(500, "Erro interno.");
  }
}
