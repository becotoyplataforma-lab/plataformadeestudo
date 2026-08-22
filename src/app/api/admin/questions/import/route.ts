/**
 * POST /api/admin/questions/import — importa questões prontas (admin).
 * Aceita CSV, XLSX ou JSON. Questões entram em EM_REVISÃO.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import {
  AdminGuardService,
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import {
  QuestionImportService,
  QuestionImportError,
} from "@/lib/administration/services/question-import.service";

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const subjectId = (formData.get("subject_id") as string) || "";
    const banca = (formData.get("banca") as string) || undefined;
    const cargo = (formData.get("cargo") as string) || undefined;
    const anoRaw = (formData.get("ano") as string) || undefined;

    if (!file) {
      return NextResponse.json({ error: "NO_FILE", message: "Arquivo não enviado." }, { status: 400 });
    }
    const subject = z.string().uuid().safeParse(subjectId);
    if (!subject.success) {
      return NextResponse.json({ error: "SUBJECT_REQUIRED", message: "Selecione a matéria." }, { status: 400 });
    }
    const ano = anoRaw ? Number.parseInt(anoRaw, 10) : undefined;

    const result = await QuestionImportService.importQuestions({
      adminUserId: admin.userId,
      file,
      subjectId,
      defaultBanca: banca,
      defaultCargo: cargo,
      defaultAno: ano,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof QuestionImportError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 422 });
    }
    console.error("[admin/questions/import] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha na importação de questões." },
      { status: 500 }
    );
  }
}
