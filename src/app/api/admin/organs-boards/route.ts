/**
 * GET/POST /api/admin/organs-boards — catálogos de órgãos e bancas (admin).
 *
 * GET  → lista órgãos e bancas ativos;
 * POST → cria órgão ({ type: "organ" }) ou banca ({ type: "board" }).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import {
  AdminGuardService,
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import {
  OrganBoardService,
  OrganBoardError,
  type OrganBoardCreateInput,
} from "@/lib/administration/services/organ-board.service";

const CreateSchema = z.object({
  type: z.enum(["organ", "board"]),
  name: z.string().min(2).max(200),
  description: z.string().max(2000).nullable().optional(),
});

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const result = await OrganBoardService.list(admin);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/organs-boards GET] Erro:", error);
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

    const input: OrganBoardCreateInput = {
      type: parsed.data.type,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    };

    const row = await OrganBoardService.create(admin, input);
    return NextResponse.json({ id: row.id, name: row.name, slug: row.slug }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof OrganBoardError) {
      const status = error.code === "DUPLICATE_SLUG" ? 409 : 422;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[admin/organs-boards POST] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao criar órgão/banca." },
      { status: 500 }
    );
  }
}
