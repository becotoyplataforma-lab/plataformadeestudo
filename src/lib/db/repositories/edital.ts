/**
 * ConcursoAI — repositório de edital (leitura Drizzle)
 *
 * Matérias/pesos do edital vigente do aluno (notice_subjects), para vincular
 * apostilas do aluno à geração de questões.
 */
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { editais, noticeSubjects } from "@/db/schema/contest";
import { knowledgeSubjects } from "@/db/schema/knowledge";

export interface EditalSubject {
  subjectId: string;
  subjectName: string;
  weight: number;
  editalId: string;
  positionId: string | null;
}

/** Edital vigente de um concurso. */
export async function getCurrentEditalByContest(
  contestId: string
): Promise<{ id: string } | null> {
  const [edital] = await db
    .select({ id: editais.id })
    .from(editais)
    .where(
      and(
        eq(editais.contestId, contestId),
        eq(editais.isCurrent, true),
        isNull(editais.deletedAt)
      )
    )
    .limit(1);
  return edital ?? null;
}

/** Matérias do edital vigente do concurso/cargo do aluno (com pesos). */
export async function listEditalSubjectsForStudent(
  contestId: string,
  positionId: string | null
): Promise<EditalSubject[]> {
  const edital = await getCurrentEditalByContest(contestId);
  if (!edital) return [];

  const conditions = [
    eq(noticeSubjects.editalId, edital.id),
    isNull(noticeSubjects.deletedAt),
  ];
  if (positionId) {
    conditions.push(
      or(
        eq(noticeSubjects.positionId, positionId),
        isNull(noticeSubjects.positionId)
      )!
    );
  } else {
    conditions.push(isNull(noticeSubjects.positionId));
  }

  const rows = await db
    .select({
      subjectId: noticeSubjects.knowledgeSubjectId,
      subjectName: knowledgeSubjects.name,
      weight: noticeSubjects.weight,
      editalId: noticeSubjects.editalId,
      positionId: noticeSubjects.positionId,
    })
    .from(noticeSubjects)
    .innerJoin(
      knowledgeSubjects,
      eq(noticeSubjects.knowledgeSubjectId, knowledgeSubjects.id)
    )
    .where(and(...conditions))
    .orderBy(sql`${noticeSubjects.weight} DESC`);

  return rows.map((r) => ({
    subjectId: r.subjectId,
    subjectName: r.subjectName,
    weight: r.weight,
    editalId: r.editalId,
    positionId: r.positionId,
  }));
}

/** Peso de uma matéria específica no edital vigente do aluno. */
export async function getEditalSubjectWeight(
  contestId: string,
  positionId: string | null,
  subjectId: string
): Promise<{ weight: number; editalId: string } | null> {
  const subjects = await listEditalSubjectsForStudent(contestId, positionId);
  const found = subjects.find((s) => s.subjectId === subjectId);
  return found ? { weight: found.weight, editalId: found.editalId } : null;
}
