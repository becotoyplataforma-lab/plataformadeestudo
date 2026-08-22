/**
 * ConcursoAI — isolamento de conhecimento por curso/cargo/edital
 *
 * Funções de validação de escopo usadas para impedir que um aluno receba
 * contexto RAG de material de outro curso/cargo/edital.
 *
 * A fonte de verdade é o perfil autenticado no backend (nunca o cliente).
 */
import { getCurrentEditalByContest } from "@/lib/db/repositories/edital";
import type { Profile } from "@/types";

/** Escopo de curso/cargo/edital resolvido a partir do perfil autenticado. */
export interface CourseScope {
  positionId?: string;
  editalId?: string;
}

/**
 * Resolve o escopo de curso/cargo/edital do usuário autenticado a partir do
 * perfil (fonte de verdade no backend). Regras:
 *  - Se o aluno tem cargo (position_id): usa position_id como filtro principal.
 *  - Se não tem cargo mas tem concurso (contest_id): usa o edital vigente do
 *    concurso (edital_id) como fallback.
 *  - Se não tem nem concurso nem cargo: NÃO inventa curso — retorna vazio
 *    (mantém o comportamento atual, sem filtro de isolamento).
 */
export async function resolveCourseScope(
  profile: Profile | null
): Promise<CourseScope> {
  if (!profile) return {};

  if (profile.position_id) {
    return { positionId: profile.position_id };
  }

  if (profile.contest_id) {
    const edital = await getCurrentEditalByContest(profile.contest_id).catch(
      () => null
    );
    if (edital) return { editalId: edital.id };
  }

  return {};
}

/**
 * Verifica se um documento pertence ao escopo de curso/cargo/edital do aluno.
 * Fonte de verdade: o perfil autenticado (backend). Regras:
 *  - Se o aluno tem cargo (position_id): o documento deve ter esse position_id.
 *  - Se não tem cargo mas tem concurso (contest_id): o documento deve ter o
 *    edital_id do edital vigente do concurso.
 *  - Se não tem nem concurso nem cargo: não há escopo definido — mantém o
 *    comportamento atual (aceita o documento do próprio usuário).
 */
export async function isDocInUserScope(
  doc: { positionId: string | null; editalId: string | null },
  profile: Profile | null
): Promise<boolean> {
  if (!profile) return true;
  if (profile.position_id) {
    return doc.positionId === profile.position_id;
  }
  if (profile.contest_id) {
    const edital = await getCurrentEditalByContest(profile.contest_id).catch(
      () => null
    );
    // Sem cargo, o escopo é o edital vigente do concurso: o documento deve
    // pertencer a esse edital. Se não houver edital vigente, não há escopo
    // definido — mantém o comportamento atual.
    if (!edital) return true;
    return doc.editalId === edital.id;
  }
  return true;
}
