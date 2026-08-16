/**
 * ConcursoAI — ContestIntelligenceService (FASE 4 — v1 honesta)
 *
 * Dado um edital importado, mostra:
 *   - distribuição de peso por matéria (notice_subjects);
 *   - se houver questões antigas da MESMA banca no banco, um resumo de quais
 *     matérias essa banca mais cobra historicamente (contagem por matéria).
 *
 * NÃO inventa dado: se a banca for desconhecida ou o histórico for pequeno,
 * retorna isso explicitamente (`bancaConhecida`/`historicoSuficiente`).
 */
import "server-only";
import { and, eq, isNull, count, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { editais, contests, boards, noticeSubjects } from "@/db/schema/contest";
import { knowledgeSubjects } from "@/db/schema/knowledge";
import { questions } from "@/db/schema/study";

export class ContestIntelligenceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ContestIntelligenceError";
    this.code = code;
  }
}

export interface EditalSubjectWeight {
  subjectId: string;
  subjectName: string;
  weight: number;
}

export interface HistoricalSubject {
  subjectId: string;
  subjectName: string;
  count: number;
  sharePercent: number;
}

export interface ContestIntelligence {
  editalId: string;
  editalTitle: string;
  banca: string | null;
  bancaConhecida: boolean;
  materias: EditalSubjectWeight[];
  historico: HistoricalSubject[];
  totalHistorico: number;
  historicoSuficiente: boolean;
}

const MIN_HISTORICO = 5; // nº mínimo de questões para considerar o histórico "suficiente"

export const ContestIntelligenceService = {
  async analyze(editalId: string): Promise<ContestIntelligence> {
    const [edital] = await db
      .select()
      .from(editais)
      .where(and(eq(editais.id, editalId), isNull(editais.deletedAt)))
      .limit(1);
    if (!edital) {
      throw new ContestIntelligenceError("EDITAL_NOT_FOUND", "Edital não encontrado.");
    }

    // Banca do concurso (via contests → boards).
    let banca: string | null = null;
    const [contest] = await db
      .select()
      .from(contests)
      .where(eq(contests.id, edital.contestId))
      .limit(1);
    if (contest) {
      const [board] = await db
        .select({ name: boards.name })
        .from(boards)
        .where(eq(boards.id, contest.boardId))
        .limit(1);
      banca = board?.name ?? null;
    }

    // Distribuição de peso por matéria (fonte: notice_subjects).
    const materias = await db
      .select({
        subjectId: noticeSubjects.knowledgeSubjectId,
        subjectName: knowledgeSubjects.name,
        weight: noticeSubjects.weight,
      })
      .from(noticeSubjects)
      .innerJoin(
        knowledgeSubjects,
        eq(noticeSubjects.knowledgeSubjectId, knowledgeSubjects.id)
      )
      .where(
        and(eq(noticeSubjects.editalId, editalId), isNull(noticeSubjects.deletedAt))
      )
      .orderBy(desc(noticeSubjects.weight));

    // Histórico da banca (questões publicadas agrupadas por matéria).
    const historico: HistoricalSubject[] = [];
    let totalHistorico = 0;
    if (banca) {
      const histRows = await db
        .select({
          subjectId: questions.knowledgeSubjectId,
          n: count(),
        })
        .from(questions)
        .where(
          and(
            eq(questions.banca, banca),
            eq(questions.status, "publicada"),
            isNull(questions.deletedAt)
          )
        )
        .groupBy(questions.knowledgeSubjectId);

      totalHistorico = histRows.reduce((acc, r) => acc + Number(r.n), 0);

      const ids = histRows.map((r) => r.subjectId);
      const names = ids.length
        ? await db
            .select({ id: knowledgeSubjects.id, name: knowledgeSubjects.name })
            .from(knowledgeSubjects)
            .where(inArray(knowledgeSubjects.id, ids))
        : [];
      const nameById = new Map(names.map((n) => [n.id, n.name]));

      historico.push(
        ...histRows
          .map((r) => ({
            subjectId: r.subjectId,
            subjectName: nameById.get(r.subjectId) ?? "Matéria",
            count: Number(r.n),
            sharePercent: totalHistorico
              ? Math.round((Number(r.n) / totalHistorico) * 1000) / 10
              : 0,
          }))
          .sort((a, b) => b.count - a.count)
      );
    }

    return {
      editalId: edital.id,
      editalTitle: edital.title,
      banca,
      bancaConhecida: Boolean(banca) && banca !== "Banca a confirmar — PMERJ (REAL)",
      materias,
      historico,
      totalHistorico,
      historicoSuficiente: totalHistorico >= MIN_HISTORICO,
    };
  },
};
