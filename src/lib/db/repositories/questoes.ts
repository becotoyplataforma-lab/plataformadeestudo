/**
 * Repositório de questões — catálogo público (leitura) e gabaritos.
 *
 * Migrado de Supabase REST (createClient/anon) para Drizzle (role postgres, sem RLS).
 * Motivo: o embedding REST `subject:knowledge_subjects(*)` como anon dispara
 * `permission denied for table users` (42501) — a policy admin de `knowledge_subjects`
 * referencia `auth.users` via subquery, e o role anon não tem SELECT nessa tabela.
 * Com Drizzle o produto lê via role postgres (bypass RLS), consistente com o app
 * (user-data via Drizzle).
 */
import { and, eq, ilike, inArray, isNotNull, isNull, not, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import {
  knowledgeSubjects,
  questionOptions,
  questions,
} from "@/db/schema";
import { ENUNCIADOS_FIXTURA, PREFIXOS_ENUNCIADO_FIXTURA, ehMateriaDeFixtura } from "@/lib/db/fixturas-de-teste";
import type { QuestionFilters } from "@/lib/validations/questoes";
import type { Question, QuestionOption } from "@/types";

interface QuestionRow {
  id: string;
  knowledgeSubjectId: string;
<<<<<<< HEAD
=======
  knowledgeTopicId: string | null;
  topic: string | null;
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
  subjectId: string | null;
  subjectName: string | null;
  subjectSlug: string | null;
  subjectColor: string | null;
  subjectDescription: string | null;
  banca: string | null;
  cargo: string | null;
  ano: number | null;
  nivel: Question["nivel"];
  enunciado: string;
  gabarito: string;
  explicacao: string | null;
  tipo: string;
  fonte: string | null;
  isPublic: boolean;
}

/** Mapeia a linha do join questions↔knowledge_subjects para o shape Question (snake_case nested). */
function toQuestion(row: QuestionRow, options: QuestionOption[] = []): Question {
  return {
    id: row.id,
    subject_id: row.knowledgeSubjectId,
<<<<<<< HEAD
=======
    topic_id: row.knowledgeTopicId,
    topic: row.topic,
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
    banca: row.banca,
    cargo: row.cargo,
    ano: row.ano,
    nivel: row.nivel,
    enunciado: row.enunciado,
    gabarito: row.gabarito,
    explicacao: row.explicacao,
    tipo: row.tipo,
    fonte: row.fonte,
    is_public: row.isPublic,
    subject: row.subjectId
      ? {
          id: row.subjectId,
          name: row.subjectName ?? "",
          slug: row.subjectSlug ?? "",
          color: row.subjectColor,
          description: row.subjectDescription,
        }
      : null,
    options,
  };
}

const BASE_SELECT = {
  id: questions.id,
  knowledgeSubjectId: questions.knowledgeSubjectId,
<<<<<<< HEAD
=======
  knowledgeTopicId: questions.knowledgeTopicId,
  topic: questions.topic,
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
  subjectId: knowledgeSubjects.id,
  subjectName: knowledgeSubjects.name,
  subjectSlug: knowledgeSubjects.slug,
  subjectColor: knowledgeSubjects.color,
  subjectDescription: knowledgeSubjects.description,
  banca: questions.banca,
  cargo: questions.cargo,
  ano: questions.ano,
  nivel: questions.nivel,
  enunciado: questions.enunciado,
  gabarito: questions.gabarito,
  explicacao: questions.explicacao,
  tipo: questions.tipo,
  fonte: questions.fonte,
  isPublic: questions.isPublic,
};

/**
 * Exclusão de fixtura de teste. Só coluna de `questions`: as mesmas condições
 * alimentam a contagem do `count(*)` (que não dá join), então qualquer cláusula
 * aqui precisa ser resolvida sem tocar em `knowledge_subjects`.
 */
function foraDeFixtura() {
  return [
    notInArray(questions.enunciado, [...ENUNCIADOS_FIXTURA]),
    ...PREFIXOS_ENUNCIADO_FIXTURA.map((prefixo) =>
      not(ilike(questions.enunciado, `${prefixo}%`))
    ),
  ];
}

/** Condições de "questão pública e publicada" (soft-delete e fixtura fora). */
function publicConditions() {
  return [
    eq(questions.isPublic, true),
    eq(questions.status, "publicada"),
    isNull(questions.deletedAt),
    ...foraDeFixtura(),
  ];
}

/**
 * Quantas questões publicadas existem para uma matéria canônica.
 *
 * Sai do repositório em vez de ficar montado na página para que a contagem do
 * caderno e a lista obedeçam à mesma regra de fixtura: "publicadas" que só
 * existem porque um teste inseriu não pode aparecer como acervo.
 */
export async function countPublicasDaMateria(knowledgeSubjectId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(questions)
    .where(and(eq(questions.knowledgeSubjectId, knowledgeSubjectId), ...publicConditions()));
  return total;
}

/** Options de um conjunto de questões (query batched). */
async function listOptionsForQuestions(
  questionIds: string[]
): Promise<Map<string, QuestionOption[]>> {
  if (questionIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: questionOptions.id,
      questionId: questionOptions.questionId,
      letter: questionOptions.letter,
      text: questionOptions.text,
      isCorrect: questionOptions.isCorrect,
    })
    .from(questionOptions)
    .where(
      and(
        inArray(questionOptions.questionId, questionIds),
        isNull(questionOptions.deletedAt)
      )
    )
    .orderBy(questionOptions.letter);

  const byQuestion = new Map<string, QuestionOption[]>();
  for (const r of rows) {
    const opt: QuestionOption = {
      id: r.id,
      question_id: r.questionId,
      letter: r.letter,
      text: r.text,
      is_correct: r.isCorrect,
    };
    const list = byQuestion.get(r.questionId);
    if (list) list.push(opt);
    else byQuestion.set(r.questionId, [opt]);
  }
  return byQuestion;
}

/**
 * Lista questões públicas com filtros e paginação (inclui subject e options).
 */
export async function listQuestions(
  filters: QuestionFilters
): Promise<{ data: Question[]; total: number }> {
<<<<<<< HEAD
  const { subject_id, banca, nivel, page = 1, pageSize = 15 } = filters;

  const conditions = publicConditions();
  if (subject_id) conditions.push(eq(questions.knowledgeSubjectId, subject_id));
=======
  const { subject_id, topic_id, banca, nivel, page = 1, pageSize = 15 } = filters;

  const conditions = publicConditions();
  if (subject_id) conditions.push(eq(questions.knowledgeSubjectId, subject_id));
  if (topic_id) conditions.push(eq(questions.knowledgeTopicId, topic_id));
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
  if (banca) conditions.push(eq(questions.banca, banca));
  if (nivel) conditions.push(eq(questions.nivel, nivel));

  const rows = await db
    .select(BASE_SELECT)
    .from(questions)
    .leftJoin(
      knowledgeSubjects,
      eq(questions.knowledgeSubjectId, knowledgeSubjects.id)
    )
    .where(and(...conditions))
    .orderBy(sql`${questions.createdAt} DESC`)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questions)
    .where(and(...conditions));

  const optionsByQuestion = await listOptionsForQuestions(rows.map((r) => r.id));

  return {
    data: rows.map((r) => toQuestion(r, optionsByQuestion.get(r.id) ?? [])),
    total: count,
  };
}

/** Lista matérias do catálogo (para filtros), sem as fixturas de teste. */
export async function listSubjects(): Promise<
  Array<{ id: string; name: string; color: string | null }>
> {
  const linhas = await db
    .select({
      id: knowledgeSubjects.id,
      name: knowledgeSubjects.name,
      slug: knowledgeSubjects.slug,
      color: knowledgeSubjects.color,
    })
    .from(knowledgeSubjects)
    .where(isNull(knowledgeSubjects.deletedAt))
    .orderBy(knowledgeSubjects.name);
  // Nome/slug de teste não são catálogo: "E2E a1b2c3d4" no filtro seria um
  // convite para o aluno estudar uma matéria que não existe.
  return linhas
    .filter((linha) => !ehMateriaDeFixtura(linha))
    .map(({ id, name, color }) => ({ id, name, color }));
}

/** Busca uma questão pública por ID, com options e subject. */
export async function getQuestionWithOptions(
  questionId: string
): Promise<Question | null> {
  const [row] = await db
    .select(BASE_SELECT)
    .from(questions)
    .leftJoin(
      knowledgeSubjects,
      eq(questions.knowledgeSubjectId, knowledgeSubjects.id)
    )
    .where(and(eq(questions.id, questionId), ...publicConditions()))
    .limit(1);
  if (!row) return null;
  const options = await listOptions(questionId);
  return toQuestion(row, options);
}

/** Retorna o gabarito (e explicação) de uma questão, se existir. */
export async function getGabarito(
  questionId: string
): Promise<{ gabarito: string; explicacao: string | null } | null> {
  const [q] = await db
    .select({ gabarito: questions.gabarito, explicacao: questions.explicacao })
    .from(questions)
    .where(and(eq(questions.id, questionId), isNull(questions.deletedAt)))
    .limit(1);
  return q ?? null;
}

/** Lista as alternativas de uma questão. */
export async function listOptions(questionId: string): Promise<QuestionOption[]> {
  const rows = await db
    .select({
      id: questionOptions.id,
      letter: questionOptions.letter,
      text: questionOptions.text,
      isCorrect: questionOptions.isCorrect,
    })
    .from(questionOptions)
    .where(
      and(
        eq(questionOptions.questionId, questionId),
        isNull(questionOptions.deletedAt)
      )
    )
    .orderBy(questionOptions.letter);
  return rows.map((r) => ({
    id: r.id,
    question_id: questionId,
    letter: r.letter,
    text: r.text,
    is_correct: r.isCorrect,
  }));
}

/** Lista de bancas disponíveis para filtros. */
export async function listBancas(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ banca: questions.banca })
    .from(questions)
    .where(and(...publicConditions(), isNotNull(questions.banca)));
  return rows
    .map((r) => r.banca)
    .filter((b): b is string => Boolean(b))
    .sort((a, b) => a.localeCompare(b));
}
