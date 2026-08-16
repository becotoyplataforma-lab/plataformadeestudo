/**
 * POST /api/essay/correct — correção de redação pelo Professor IA (aluno).
 * Respeita a cota diária de IA do plano (getAiUsage/resolveUserLimits).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { getAiUsage, registerUsage } from "@/lib/ai/limits";
import { resolveUserLimits } from "@/lib/billing/services/limits.resolver";
import {
  EssayCorrectionService,
  EssayCorrectionError,
} from "@/lib/ai/services/essay-correction.service";
import { ProviderError } from "@/lib/ai/services/deepseek-provider.service";

const EssaySchema = z.object({
  text: z.string().min(1).max(15000),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json().catch(() => null);
    const parsed = EssaySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
    }

    // Cota diária de IA do plano.
    const usage = await getAiUsage(userId, await resolveUserLimits(userId));
    if (!usage.canSend) {
      return NextResponse.json(
        {
          error: "LIMIT_REACHED",
          message: `Você atingiu o limite diário de mensagens de IA do seu plano (${usage.maxMessages}/dia). Tente novamente amanhã ou faça upgrade.`,
        },
        { status: 429 }
      );
    }

    const { data, tokensIn, tokensOut } = await EssayCorrectionService.correct(parsed.data.text);
    await registerUsage(userId, tokensIn, tokensOut);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof EssayCorrectionError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.code === "AI_NOT_CONFIGURED" ? 503 : 422 }
      );
    }
    if (error instanceof ProviderError) {
      return NextResponse.json({ error: "PROVIDER_FAILED", message: error.message }, { status: 502 });
    }
    console.error("[essay/correct] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao corrigir a redação." },
      { status: 500 }
    );
  }
}
