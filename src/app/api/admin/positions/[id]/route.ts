/**
 * PATCH/DELETE /api/admin/positions/[id] — cargo individual (admin).
 *
 * PATCH  → atualiza cargo;
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
  PositionService,
  PositionError,
  type PositionServiceUpdateInput,
} from "@/lib/administration/services/position.service";

const UpdateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  edital_id: z.string().uuid().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
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

    const input: PositionServiceUpdateInput = {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      editalId: parsed.data.edital_id,
      status: parsed.data.status,
    };

    const row = await PositionService.update(admin, id, input);
    return NextResponse.json({ id: row.id, name: row.name, slug: row.slug, contestId: row.contestId });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof PositionError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "DUPLICATE_SLUG"
            ? 409
            : 422;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[admin/positions PATCH] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao atualizar cargo." },
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
    const row = await PositionService.softDelete(admin, id);
    return NextResponse.json({ id: row.id, name: row.name, deleted: true });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof PositionError) {
      const status = error.code === "NOT_FOUND" ? 404 : 422;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[admin/positions DELETE] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao remover cargo." },
      { status: 500 }
    );
  }
}
