/**
 * POST /api/admin/editais/apply — aplica a estrutura confirmada do edital (admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import {
  EditalApplyService,
  EditalApplyError,
} from "@/lib/administration/services/edital.service";

const MateriaSchema = z.object({
  name: z.string().min(2).max(120),
  weight: z.number().int().min(0).max(100),
});

const ApplySchema = z.object({
  document_id: z.string().uuid(),
  contest_id: z.string().uuid(),
  position_id: z.string().uuid().nullable().optional(),
  title: z.string().max(300).optional(),
  banca: z.string().max(100).optional(),
  materias: z.array(MateriaSchema).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const parsed = ApplySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await EditalApplyService.apply({
      documentId: parsed.data.document_id,
      contestId: parsed.data.contest_id,
      positionId: parsed.data.position_id ?? null,
      title: parsed.data.title,
      banca: parsed.data.banca,
      materias: parsed.data.materias,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof EditalApplyError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.code === "DOC_NOT_FOUND" ? 404 : 422 }
      );
    }
    console.error("[admin/editais/apply] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao aplicar a estrutura do edital." },
      { status: 500 }
    );
  }
}
