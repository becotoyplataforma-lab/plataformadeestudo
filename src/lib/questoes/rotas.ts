/**
 * ConcursoAI — Gramática de rotas do caderno de questões.
 *
 * A rota pertence ao domínio de estudo (matéria), não ao arquivo físico de
 * origem. O caderno é `/questoes/<slug-da-materia>` e a questão é
 * `/questoes/<id>`. "Aula 14", número do curso de terceiro, banca, ano e
 * prova-alvo são **metadado de procedência**: entram como tag de filtro na
 * query string (`?banca=vunesp&assunto=pontuacao&origem=aula-14`), nunca como
 * segmento de path. Uma apostila nova não cria rota nem item de menu: cria
 * linha no catálogo (`src/lib/questoes/cadernos.ts`).
 *
 * A trilha antiga `/cbm-rj/portugues/questoes/aula-14` continua respondendo por
 * redirecionamento (ver `next.config.ts`): mover a rota não reescreve a
 * procedência de nenhuma questão, e um link já distribuído não pode virar 404.
 */

const BASE = "/questoes";

/** Matéria canônica do catálogo (`knowledge_subjects.slug`) que abre o caderno. */
export function caderno(materiaSlug: string): string {
  return `${BASE}/${encodeURIComponent(materiaSlug)}`;
}

/** Questão individual: uuid do banco ou código local de lote extraído. */
export function questao(id: string): string {
  return `${BASE}/${encodeURIComponent(id)}`;
}

/** Caderno com tags de procedência aplicadas. Sem filtro, devolve a rota limpa. */
export function cadernoComFiltros(materiaSlug: string, query: string): string {
  return query.length === 0 ? caderno(materiaSlug) : `${caderno(materiaSlug)}?${query}`;
}

/**
 * Navegador do banco de questões publicadas (`questions`), separado do caderno.
 *
 * São duas leituras diferentes do mesmo domínio: o caderno é o lote em arquivo
 * que o aluno estuda hoje; o navegador é o que já passou por importação e
 * moderação. Misturar os dois na mesma rota foi o que fez um card de teste de
 * integração aparecer como conteúdo de prova para o aluno.
 */
export function banco(): string {
  return `${BASE}/banco`;
}

export const rotasQuestoes = {
  raiz: BASE,
  caderno,
  questao,
  banco,
  cadernoComFiltros,
} as const;

/**
 * Código local do lote extraído (`A14-S01-001`: seção + número, porque o PDF
 * reinicia a contagem por seção). É chave opaca e estável — os `content_hash`,
 * a quarentena e o smoke E2E dependem dela — então continua valendo como
 * identificador em URL; o que ele não pode é virar nome de rota ou de menu. O
 * `A14` dentro do código é procedência, não navegação.
 */
export const PADRAO_ID_LOCAL = /^A\d{2}-S\d{2}-\d{3}$/;

/** UUID de questão já gravada em banco (`questions.id`). */
export const PADRAO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehIdLocalValido(id: string): boolean {
  return PADRAO_ID_LOCAL.test(id);
}

export function ehUuid(id: string): boolean {
  return PADRAO_UUID.test(id);
}

/**
 * Interpreta um código local em (aula, seção, número).
 *
 * `aula` aqui é leitura de procedência: serve para a sanfona do card dizer de
 * qual material o item saiu, e para mais nada. Devolve null para id malformado,
 * em vez de lançar: a rota usa isso antes de procurar no lote e pode responder
 * 404 de forma limpa.
 */
export function decomporIdLocal(
  id: string
): { aula: number; secao: number; numero: number } | null {
  const m = /^A(\d{2})-S(\d{2})-(\d{3})$/.exec(id);
  if (!m) return null;
  return { aula: Number(m[1]), secao: Number(m[2]), numero: Number(m[3]) };
}
