/**
 * GET /api/knowledge/topics?subject_id={id}
 *
 * Lista tópicos de uma matéria.
 */
import { NextRequest, NextResponse } from "next/server";
import { KnowledgeTopicRepository } from "@/lib/knowledge/repositories/topic.repository";
import { mapTopicToDto } from "@/lib/dto/knowledge.dto";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subject_id");

    if (!subjectId) {
      return NextResponse.json(
        { error: "Parâmetro subject_id é obrigatório" },
        { status: 400 }
      );
    }

    const topics = await KnowledgeTopicRepository.getAllBySubject(subjectId);
    return NextResponse.json(topics.map(mapTopicToDto));
  } catch (error) {
    console.error("[knowledge/topics] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
