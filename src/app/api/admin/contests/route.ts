/**
 * GET/POST /api/admin/contests — concursos (admin).
 *
 * GET  → lista concursos (todos os status);
 * POST → cria concurso (nasce como `rascunho`).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import {
  AdminGuardService,
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import {
  ContestService,
  ContestError,
  type ContestServiceCreateInput,
} from "@/lib/administration/services/contest.service";

const ContestStatusSchema = z.enum(["rascunho", "publicado", "encerrado", "arquivado"]);

const CreateSchema = z.object({
  organ_id: z.string().uuid(),
  board_id: z.string().uuid(),
  title: z.string().min(3).max(200),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: ContestStatusSchema.optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const contests = await ContestService.list(admin);
    return NextResponse.json(contests);
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/contests GET] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const body = await request.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const input: ContestServiceCreateInput = {
      organId: parsed.data.organ_id,
      boardId: parsed.data.board_id,
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      startDate: parsed.data.start_date,
      endDate: parsed.data.end_date,
    };

    const row = await ContestService.create(admin, input);
    return NextResponse.json({ id: row.id, title: row.title, slug: row.slug, status: row.status }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof ContestError) {
      const status =
        error.code === "DUPLICATE_SLUG"
          ? 409
          : error.code === "ORG_NOT_FOUND" || error.code === "BOARD_NOT_FOUND"
            ? 422
            : 422;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[admin/contests POST] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao criar concurso." },
      { status: 500 }
    );
  }
}
