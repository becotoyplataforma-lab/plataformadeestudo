/**
 * POST /api/ai/chat
 *
 * Envia mensagem ao Professor IA (sem RAG, sem busca vetorial).
 * Fluxo: User → Prompt Builder → DeepSeek → Resposta.
 * Controle de tokens, custos, tempo, modelo e usage ficam nos Services.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { ChatService, ChatError } from "@/lib/ai/services/chat.service";
import { ChatRequestDtoSchema } from "@/lib/dto/ai.dto";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = ChatRequestDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await ChatService.send({
      userId: session.user.id,
      message: parsed.data.message,
      sessionId: parsed.data.session_id,
      subjectId: parsed.data.subject_id,
      model: parsed.data.model,
    });

    return NextResponse.json({
      session_id: result.sessionId,
      message_id: result.messageId,
      response: result.response,
      model: result.model,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      total_tokens: result.totalTokens,
      cost_brl: result.costBRL,
      latency_ms: result.latencyMs,
    });
  } catch (error) {
    if (error instanceof ChatError) {
      const status = error.code === "SESSION_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[ai/chat] Erro:", error);
    return NextResponse.json({ error: "Erro interno", message: "Falha ao processar a mensagem." }, { status: 500 });
  }
}
