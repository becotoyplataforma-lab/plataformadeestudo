/**
 * Admin — Questão (Curadoria)
 *
 * PATCH /api/admin/questions/[id] — altera status de curadoria (admin)
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/administration/session";
import { strictDto } from "@/lib/dto";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import {
  ModerationService,
  ModerationError,
} from "@/lib/administration/services/moderation.service";
import {
  SetQuestionStatusRequestDtoSchema,
  QuestionStatusDtoSchema,
  mapQuestionStatusToDto,
} from "@/lib/dto/administration.dto";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id } = await ctx.params;
    const body = await request.json();
    const parsed = SetQuestionStatusRequestDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const row = await ModerationService.setStatus(
      admin,
      id,
      parsed.data.status,
      { status: parsed.data.status }
    );
    return NextResponse.json(strictDto(QuestionStatusDtoSchema, mapQuestionStatusToDto(row)));
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof ModerationError) {
      const status = error.code === "QUESTION_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[admin/questions/[id]] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao moderar questão." },
      { status: 500 }
    );
  }
}
