/**
 * POST /api/admin/editais/parse — extrai estrutura do edital via IA (admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import {
  AdminGuardService,
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import {
  EditalParsingService,
  EditalParsingError,
} from "@/lib/ai/services/edital-parsing.service";
import { ProviderError } from "@/lib/ai/services/deepseek-provider.service";

const ParseSchema = z.object({ document_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const body = await request.json().catch(() => null);
    const parsed = ParseSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const suggestions = await EditalParsingService.parseFromDocument(parsed.data.document_id);
    return NextResponse.json({ suggestions });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof EditalParsingError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.code === "DOC_NOT_FOUND" ? 404 : 422 }
      );
    }
    if (error instanceof ProviderError || (error instanceof Error && error.message.includes("DEEPSEEK_API_KEY"))) {
      return NextResponse.json(
        { error: "AI_NOT_CONFIGURED", message: "O serviço de IA não está configurado." },
        { status: 503 }
      );
    }
    console.error("[admin/editais/parse] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao analisar o edital." },
      { status: 500 }
    );
  }
}
