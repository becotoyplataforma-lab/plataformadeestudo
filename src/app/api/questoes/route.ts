<<<<<<< HEAD
import { createClient } from "@/lib/supabase/server";
=======
import { auth } from "@/lib/auth/auth";
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
import { apiError, apiOk } from "@/lib/api/helpers";
import { questionFiltersSchema } from "@/lib/validations/questoes";
import { listQuestions } from "@/lib/db/repositories/questoes";
import { DEMO_QUESTIONS } from "@/lib/constants/demo-questoes";
import type { Question } from "@/types";

/**
 * GET /api/questoes — lista questões com filtros e paginação.
 * Suporta ?q= para busca textual e fallback para DEMO_QUESTIONS quando offline.
 */
export async function GET(req: Request) {
  try {
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

<<<<<<< HEAD
    const { page, pageSize, subject_id, banca, nivel } = parsed.data;
=======
    let { data, total } = await listQuestions(parsed.data);
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6

    let data: Question[] = [];
    let total = 0;

    try {
      const res = await listQuestions(parsed.data);
      data = res.data;
      total = res.total;
    } catch {
      data = [];
      total = 0;
    }

    // Fallback gracioso com filtragem local caso o banco esteja indisponível ou vazio
    if (!data || data.length === 0) {
      let filtered = [...DEMO_QUESTIONS];
      if (subject_id && subject_id !== "all") {
        filtered = filtered.filter((item) => item.subject_id === subject_id);
      }
      if (banca && banca !== "all") {
        filtered = filtered.filter(
          (item) => item.banca?.toLowerCase() === banca.toLowerCase()
        );
      }
      if (nivel) {
        filtered = filtered.filter(
          (item) => item.nivel?.toLowerCase() === nivel.toLowerCase()
        );
      }
      if (q) {
        const needle = q.toLowerCase();
        filtered = filtered.filter((item) =>
          item.enunciado.toLowerCase().includes(needle) ||
          item.subject?.name.toLowerCase().includes(needle) ||
          item.cargo?.toLowerCase().includes(needle)
        );
      }

      total = filtered.length;
      const start = (page - 1) * pageSize;
      data = filtered.slice(start, start + pageSize);
    } else if (q) {
      const needle = q.toLowerCase();
      data = data.filter((question) =>
        question.enunciado.toLowerCase().includes(needle)
      );
      total = data.length;
    }

    return apiOk({ data, total, page, pageSize });
  } catch (error) {
    console.error("[questoes] GET", error);
    return apiError(500, "Erro interno.");
  }
}
