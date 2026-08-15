/**
 * POST /api/admin/questions/[id]/review
 *
 * Revisão de questão gerada por IA: aprovar / rejeitar / publicar / bloquear /
 * revisar, com nota opcional e histórico de moderação.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import {
  ModerationService,
  ModerationError,
} from "@/lib/administration/services/moderation.service";

type Ctx = { params: Promise<{ id: string }> };

const ReviewSchema = z.object({
  action: z.enum(["aprovar", "rejeitar", "publicar", "bloquear", "revisar"]),
  notes: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = ReviewSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const row = await ModerationService.review(
      admin,
      id,
      parsed.data.action,
      parsed.data.notes
    );

    return NextResponse.json(row);
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof ModerationError) {
      const status = error.code === "QUESTION_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[admin/questions/[id]/review] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao revisar questão." },
      { status: 500 }
    );
  }
}
