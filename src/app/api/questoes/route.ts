import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/helpers";
import { questionFiltersSchema } from "@/lib/validations/questoes";
import { listQuestions } from "@/lib/db/repositories/questoes";

/**
 * GET /api/questoes — lista questões com filtros e paginação.
 * Suporta ?q= para busca textual.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");

    const url = new URL(req.url);
    const raw = {
      subject_id: url.searchParams.get("subject_id") ?? undefined,
      banca: url.searchParams.get("banca") ?? undefined,
      nivel: url.searchParams.get("nivel") ?? undefined,
      page: url.searchParams.get("page") ?? "1",
      pageSize: url.searchParams.get("pageSize") ?? "15",
    };
    const q = url.searchParams.get("q")?.trim();

    const parsed = questionFiltersSchema.safeParse(raw);
    if (!parsed.success) return apiError(422, "Filtros inválidos.");

    const db = await createClient();
    let { data, total } = await listQuestions(db, parsed.data);

    // Filtro textual (busca simples no client; no futuro usa pg_trgm no banco)
    if (q) {
      const needle = q.toLowerCase();
      data = data.filter((question) =>
        question.enunciado.toLowerCase().includes(needle)
      );
      total = data.length;
    }

    return apiOk({ data, total, page: parsed.data.page, pageSize: parsed.data.pageSize });
  } catch (error) {
    console.error("[questoes] GET", error);
    return apiError(500, "Erro interno.");
  }
}
