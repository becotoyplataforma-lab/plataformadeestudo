/**
 * GET /api/knowledge/documents
 *
 * Lista documentos do usuário autenticado.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { mapDocumentToDto } from "@/lib/dto/knowledge.dto";
import { resolveAccessScope } from "@/lib/knowledge/security/document-access";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Mesma politica da busca: proprios + compartilhados com o escopo do
    // usuario, com limite fixo.
    const scope = await resolveAccessScope(session.user.id, session.user.email);
    const rows = await DocumentRepository.listAccessible(scope, 100);
    return NextResponse.json(rows.map(mapDocumentToDto));
  } catch (error) {
    console.error("[knowledge/documents] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
