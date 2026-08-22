/**
 * GET/POST /api/admin/positions — cargos (admin).
 *
 * GET  → lista cargos de um concurso (?contest_id=...);
 * POST → cria cargo.
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
  type PositionServiceCreateInput,
} from "@/lib/administration/services/position.service";

const CreateSchema = z.object({
  contest_id: z.string().uuid(),
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  edital_id: z.string().uuid().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const contestId = request.nextUrl.searchParams.get("contest_id");
    if (!contestId) {
      return NextResponse.json(
        { error: "Requisição inválida", message: "Parâmetro contest_id é obrigatório." },
        { status: 400 }
      );
    }

    const positions = await PositionService.listByContest(admin, contestId);
    return NextResponse.json(positions);
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/positions GET] Erro:", error);
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

    const input: PositionServiceCreateInput = {
      contestId: parsed.data.contest_id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      editalId: parsed.data.edital_id ?? null,
      status: parsed.data.status,
    };

    const row = await PositionService.create(admin, input);
    return NextResponse.json({ id: row.id, name: row.name, slug: row.slug, contestId: row.contestId }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof PositionError) {
      const status =
        error.code === "DUPLICATE_SLUG"
          ? 409
          : error.code === "CONTEST_NOT_FOUND"
            ? 422
            : 422;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[admin/positions POST] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao criar cargo." },
      { status: 500 }
    );
  }
}
