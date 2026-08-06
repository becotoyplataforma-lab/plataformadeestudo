/**
 * GET /api/knowledge/subjects
 *
 * Lista todas as matérias do catálogo.
 */
import { NextResponse } from "next/server";
import { KnowledgeSubjectRepository } from "@/lib/knowledge/repositories/subject.repository";
import { mapSubjectToDto } from "@/lib/dto/knowledge.dto";

export async function GET() {
  try {
    const subjects = await KnowledgeSubjectRepository.getAll();
    return NextResponse.json(subjects.map(mapSubjectToDto));
  } catch (error) {
    console.error("[knowledge/subjects] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
