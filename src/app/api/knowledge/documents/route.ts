/**
 * GET /api/knowledge/documents
 *
 * Lista documentos do usuário autenticado.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { mapDocumentToDto } from "@/lib/dto/knowledge.dto";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const documents = await DocumentRepository.listByUser(session.user.id);
    return NextResponse.json(documents.map(mapDocumentToDto));
  } catch (error) {
    console.error("[knowledge/documents] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
