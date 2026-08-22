/**
 * POST /api/knowledge/search
 *
 * Busca híbrida sobre documentos do usuário.
 *
 * Segue: .ai/blueprints/05-hybrid-search.blueprint.md
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { HybridSearchService } from "@/lib/knowledge/services/hybrid-search.service";
import { SearchRequestDtoSchema } from "@/lib/dto/knowledge.dto";
import { getProfile } from "@/lib/db/repositories/perfil";
import { resolveCourseScope } from "@/lib/knowledge/security/course-scope";

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticação
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. Validar body
    const body = await request.json();
    const parsed = SearchRequestDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { query, subject_id, topic_id, document_id, tags, top_k } = parsed.data;

    // Isolamento por curso/cargo/edital: o escopo é resolvido no backend a
    // partir do perfil autenticado (fonte de verdade). O cliente NÃO pode
    // definir ou sobrescrever positionId/editalId.
    const profile = await getProfile(userId).catch(() => null);
    const courseScope = await resolveCourseScope(profile);

    // 3. Executar busca
    const result = await HybridSearchService.search({
      query,
      userId,
      filters: {
        subjectId: subject_id,
        topicId: topic_id,
        documentId: document_id,
        tagIds: tags,
        positionId: courseScope.positionId,
        editalId: courseScope.editalId,
      },
      topK: top_k,
    });

    // 4. Retornar
    return NextResponse.json(result);
  } catch (error) {
    console.error("[knowledge/search] Erro inesperado:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
