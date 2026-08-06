/**
 * POST /api/ai/rag
 *
 * Responde com base nos documentos do usuário (RAG Engine).
 * Fluxo: Request → RagService → HybridSearchService → PromptService → DeepSeekProvider → Response.
 *
 * Toda a lógica está nos Services (nenhuma regra de negócio na rota).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { ragService, RagError } from "@/lib/ai/services/rag.service";
import { RagRequestDtoSchema, mapRagOutputToDto } from "@/lib/dto/rag.dto";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = RagRequestDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await ragService.answer({
      question: parsed.data.question,
      userId: session.user.id,
      subjectId: parsed.data.subject_id,
      documentIds: parsed.data.document_ids,
      topK: parsed.data.top_k,
      model: parsed.data.model,
    });

    return NextResponse.json(mapRagOutputToDto(result));
  } catch (error) {
    if (error instanceof RagError) {
      const status = error.code === "EMPTY_QUESTION" ? 400 : 408;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[ai/rag] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao processar a pergunta." },
      { status: 500 }
    );
  }
}
