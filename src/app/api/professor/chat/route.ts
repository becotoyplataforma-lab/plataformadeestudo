/**
 * POST /api/professor/chat
 *
 * Application Service Professor IA — orquestra os engines existentes
 * (chat direto via ChatService ou RAG via RagService).
 *
 * Fluxo: Request → ProfessorService → Intent → Engine → Model Router →
 *        DeepSeek → Usage → Response.
 *
 * Toda a lógica está nos Services (nenhuma regra de negócio na rota).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import {
  professorService,
  ProfessorError,
} from "@/lib/ai/services/professor.service";
import { RagError } from "@/lib/ai/services/rag.service";
import { ChatError } from "@/lib/ai/services/chat.service";
import { UsageError } from "@/lib/ai/services/usage.service";
import { ProviderError } from "@/lib/ai/services/deepseek-provider.service";
import { ModelRouterError } from "@/lib/ai/services/model-router.service";
import {
  ProfessorRequestDtoSchema,
  mapProfessorOutputToDto,
} from "@/lib/dto/professor.dto";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = ProfessorRequestDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await professorService.ask({
      message: parsed.data.message,
      userId: session.user.id,
      mode: parsed.data.mode,
      sessionId: parsed.data.session_id,
      subjectId: parsed.data.subject_id,
      documentIds: parsed.data.document_ids,
      topK: parsed.data.top_k,
      model: parsed.data.model,
    });

    return NextResponse.json(mapProfessorOutputToDto(result));
  } catch (error) {
    if (error instanceof ProfessorError) {
      const status =
        error.code === "LIMIT_EXCEEDED" ? 429 : error.code === "TIMEOUT" ? 408 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    if (error instanceof RagError) {
      const status = error.code === "EMPTY_QUESTION" ? 400 : 408;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    if (error instanceof ChatError) {
      const status = error.code === "SESSION_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    if (error instanceof UsageError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
    }
    if (error instanceof ProviderError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 502 });
    }
    if (error instanceof ModelRouterError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
    }
    console.error("[professor/chat] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao processar a pergunta." },
      { status: 500 }
    );
  }
}
