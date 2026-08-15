/**
 * ConcursoAI — EditalApplyService (Administration)
 *
 * Aplica as sugestões de estrutura do edital (confirmadas pelo admin) em
 * notice_subjects, criando edital/matérias quando necessário.
 */
import "server-only";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { getCurrentEditalByContest, createEdital } from "@/lib/db/repositories/edital";
import { NoticeSubjectRepository } from "../repositories/notice-subject.repository";

export class EditalApplyError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EditalApplyError";
    this.code = code;
  }
}

export interface ApplySuggestionsInput {
  documentId: string;
  contestId: string;
  positionId?: string | null;
  title?: string;
  banca?: string;
  materias: { name: string; weight: number }[];
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

    // 2. Matérias do edital (find-or-create + peso)
    const applied: { name: string; weight: number }[] = [];
    for (const m of input.materias) {
      if (!m.name?.trim() || m.weight <= 0) continue;
      const subject = await NoticeSubjectRepository.findOrCreateSubject(m.name.trim());
      await NoticeSubjectRepository.upsertNoticeSubject({
        editalId,
        positionId: input.positionId ?? null,
        subjectId: subject.id,
        weight: Math.max(0, Math.min(100, Math.round(m.weight))),
      });
      applied.push({ name: m.name.trim(), weight: m.weight });
    }

    // 3. Vincula o documento ao edital/cargo
    await DocumentRepository.updateAssociations(doc.id, {
      editalId,
      positionId: input.positionId ?? null,
    });

    return { editalId, appliedCount: applied.length, applied };
  },
};
