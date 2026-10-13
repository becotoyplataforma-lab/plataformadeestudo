/**
 * ConcursoAI — Rotas das apostilas por disciplina.
 *
 * A trilha `/cbm-rj/...` é a organização de estudo do usuário (o concurso que
 * ele alve), NÃO um metadado da questão. O material da Aula 14 é de
 * `CBM-PE (Soldado)`, e é isso que `alvo_apostila` diz no JSON extraído. As
 * duas coisas continuam separadas de propósito: mover a rota não reescreve a
 * procedência de nenhuma questão.
 */

const BASE = "/cbm-rj/portugues";

export const rotasPortugues = {
  raiz: BASE,
  aula: (aula: number) => `${BASE}/aula-${aula}`,
  questoes: (aula: number) => `${BASE}/questoes/aula-${aula}`,
  questao: (aula: number, idLocal: string) =>
    `${BASE}/questoes/aula-${aula}/${encodeURIComponent(idLocal)}`,
  apostilas: (aula: number) => `${BASE}/apostilas/aula-${aula}`,
} as const;

/** Ids têm o formato A14-S01-001 (seção + número, pois o PDF reinicia por seção). */
export const PADRAO_ID_LOCAL = /^A\d{2}-S\d{2}-\d{3}$/;

export function ehIdLocalValido(id: string): boolean {
  return PADRAO_ID_LOCAL.test(id);
}

/**
 * Interpreta um id_local em (aula, seção, número).
 * Devolve null para id malformado, em vez de lançar: a rota usa isso antes de
 * procurar no dataset e pode responder 404 de forma limpa.
 */
export function decomporIdLocal(id: string): { aula: number; secao: number; numero: number } | null {
  const m = /^A(\d{2})-S(\d{2})-(\d{3})$/.exec(id);
  if (!m) return null;
  return { aula: Number(m[1]), secao: Number(m[2]), numero: Number(m[3]) };
}
