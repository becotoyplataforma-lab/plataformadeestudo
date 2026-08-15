/**
 * POST /api/admin/questions/generate
 *
 * Gera questões por IA a partir de uma apostila processada (admin).
 * As questões entram como EM_REVISÃO (nunca publicadas automaticamente).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import {
  QuestionGenerationService,
  GenerationServiceError,
} from "@/lib/ai/services/question-generation.service";
import { QuestionGenerationError } from "@/lib/ai/generation/question-generation.provider";

const GenerateSchema = z.object({
  document_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(20).default(5),
  nivel: z.enum(["facil", "medio", "dificil"]).optional(),
  banca: z.string().max(100).optional(),
  cargo: z.string().max(200).optional(),
  edital_id: z.string().uuid().optional(),
  position_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const parsed = GenerateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await QuestionGenerationService.generateFromDocument({
      adminUserId: admin.userId,
      documentId: parsed.data.document_id,
      subjectId: parsed.data.subject_id,
      quantity: parsed.data.quantity,
      nivel: parsed.data.nivel,
      banca: parsed.data.banca,
      cargo: parsed.data.cargo,
      editalId: parsed.data.edital_id,
      positionId: parsed.data.position_id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof GenerationServiceError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.code === "DOC_NOT_FOUND" ? 404 : 422 }
      );
    }
    if (error instanceof QuestionGenerationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 502 }
      );
    }
    console.error("[admin/questions/generate] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao gerar questões." },
      { status: 500 }
    );
  }
}
