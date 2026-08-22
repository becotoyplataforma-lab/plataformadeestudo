/**
 * PATCH/DELETE /api/admin/contests/[id] — concurso individual (admin).
 *
 * PATCH  → atualiza concurso;
 * DELETE → soft delete (marca deleted_at, não apaga dados).
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
  type ContestServiceUpdateInput,
} from "@/lib/administration/services/contest.service";

const ContestStatusSchema = z.enum(["rascunho", "publicado", "encerrado", "arquivado"]);

const UpdateSchema = z.object({
  organ_id: z.string().uuid().optional(),
  board_id: z.string().uuid().optional(),
  title: z.string().min(3).max(200).optional(),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: ContestStatusSchema.optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = UpdateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const input: ContestServiceUpdateInput = {
      organId: parsed.data.organ_id,
      boardId: parsed.data.board_id,
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description,
      status: parsed.data.status,
      startDate: parsed.data.start_date,
      endDate: parsed.data.end_date,
    };

    const row = await ContestService.update(admin, id, input);
    return NextResponse.json({ id: row.id, title: row.title, slug: row.slug, status: row.status });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof ContestError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "DUPLICATE_SLUG"
            ? 409
            : 422;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[admin/contests PATCH] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao atualizar concurso." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const { id } = await params;
    const row = await ContestService.softDelete(admin, id);
    return NextResponse.json({ id: row.id, title: row.title, deleted: true });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof ContestError) {
      const status = error.code === "NOT_FOUND" ? 404 : 422;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[admin/contests DELETE] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao remover concurso." },
      { status: 500 }
    );
  }
}
