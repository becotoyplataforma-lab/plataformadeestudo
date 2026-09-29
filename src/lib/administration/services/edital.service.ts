/**
 * ConcursoAI — EditalApplyService (Administration)
 *
 * Aplica as sugestões de estrutura do edital (confirmadas pelo admin) em
 * notice_subjects e notice_topics, criando edital/matérias quando necessário
 * e vinculando deterministicamente os tópicos aos knowledge_topics.
 */
import "server-only";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { getCurrentEditalByContest, createEdital } from "@/lib/db/repositories/edital";
import { TopicResolverService } from "@/lib/knowledge/services/topic-resolver.service";
import { NoticeSubjectRepository } from "../repositories/notice-subject.repository";
import {
  NoticeTopicRepository,
  type NoticeTopicInput,
} from "../repositories/notice-topic.repository";

export class EditalApplyError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EditalApplyError";
    this.code = code;
  }
}

export interface ApplyTopicInput {
  name: string;
  weight?: number | null;
  parent?: string | null;
}

export interface ApplyMateriaInput {
  name: string;
  weight: number;
  topicos?: ApplyTopicInput[];
}

export interface ApplySuggestionsInput {
  documentId: string;
  contestId: string;
  positionId?: string | null;
  title?: string;
  banca?: string;
  materias: ApplyMateriaInput[];
}

export const EditalApplyService = {
  async apply(input: ApplySuggestionsInput) {
    const doc = await DocumentRepository.findById(input.documentId);
    if (!doc) throw new EditalApplyError("DOC_NOT_FOUND", "Documento não encontrado.");
    if (doc.status !== "chunked" && doc.status !== "indexed") {
      throw new EditalApplyError(
        "DOC_NOT_READY",
        `Documento em estado ${doc.status}; processe antes de aplicar.`
      );
    }

    // 1. Edital vigente do concurso (ou cria se não existir)
    let edital = await getCurrentEditalByContest(input.contestId);
    if (!edital) {
      const created = await createEdital({
        contestId: input.contestId,
        title: input.title ?? doc.title,
        isCurrent: true,
        status: "rascunho",
      });
      edital = { id: created.id };
    }
    const editalId = edital.id;

    // 2. Matérias e Tópicos do edital (find-or-create + peso + resolução determinística)
    const applied: { name: string; weight: number }[] = [];
    let appliedTopicsCount = 0;

    for (const m of input.materias) {
      if (!m.name?.trim() || m.weight <= 0) continue;
      const subject = await NoticeSubjectRepository.findOrCreateSubject(m.name.trim());
      const noticeSubject = await NoticeSubjectRepository.upsertNoticeSubject({
        editalId,
        positionId: input.positionId ?? null,
        subjectId: subject.id,
        weight: Math.max(0, Math.min(100, Math.round(m.weight))),
      });
      applied.push({ name: m.name.trim(), weight: m.weight });

      // Se houver tópicos estruturados informados para esta disciplina:
      if (m.topicos && Array.isArray(m.topicos) && m.topicos.length > 0) {
        const topicInputs: NoticeTopicInput[] = [];

        for (const t of m.topicos) {
          if (!t.name?.trim()) continue;

          // Resolução determinística contra knowledge_topics da mesma disciplina
          const resolved = await TopicResolverService.resolveTopic({
            topicName: t.name,
            subjectId: subject.id,
          });

          topicInputs.push({
            name: t.name.trim(),
            weight: t.weight != null && !isNaN(t.weight) ? t.weight : null,
            parentName: t.parent?.trim() || null,
            knowledgeTopicId: resolved.topicId,
            metadata: {
              source_text: t.name.trim(),
              resolved_method: resolved.method,
            },
          });
        }

        const insertedTopics = await NoticeTopicRepository.replaceTopicsForNoticeSubject(
          noticeSubject.id,
          topicInputs
        );
        appliedTopicsCount += insertedTopics.length;
      }
    }

    // 3. Vincula o documento ao edital/cargo
    await DocumentRepository.updateAssociations(doc.id, {
      editalId,
      positionId: input.positionId ?? null,
    });

    return {
      editalId,
      appliedCount: applied.length,
      applied,
      appliedTopicsCount,
    };
  },
};
