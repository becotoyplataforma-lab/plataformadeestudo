import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/helpers";
import { getDashboardSummary } from "@/lib/db/repositories/analises";

/** GET /api/analises/resumo — KPIs agregados do usuário */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");

    const db = await createClient();
    const summary = await getDashboardSummary(db, session.user.id);
    return apiOk(summary);
  } catch (error) {
    console.error("[analises] resumo", error);
    return apiError(500, "Erro interno.");
  }
}
