/**
 * ConcursoAI — Reconhecimento de fixturas de teste que vazaram para o acervo.
 *
 * Por que isto existe: os testes de integração (`src/integration/*.test.ts`) e
 * alguns fluxos E2E inserem questões direto em Postgres com
 * `status = "publicada"` e `isPublic = true` para provar agregação de estudo.
 * `deleteTestUser()` limpa o que pertence ao usuário, mas `questions` e
 * `knowledge_subjects` criadas por esses testes não têm `user_id` — sobram como
 * linhas órfãs, e a tela de questões do aluno passa a mostrar "E2E 58f07a7b" e
 * "Qual é a pergunta?" como se fossem conteúdo de prova.
 *
 * A regra é de LEITURA, não de escrita: escondemos o que tem firma de fixtura
 * em vez de dar DELETE em banco compartilhado. Apagar dado alheio sem
 * homologação humana é exatamente o que o guard de ambiente (`src/lib/db/env-guard.ts`)
 * existe para impedir. A limpeza física fica para quando o banco de teste for
 * comprovadamente isolado e alguém aprovar o script.
 *
 * O padrão é restrito de propósito: casa nome de matéria gerado por teste
 * (`E2E <hex8>`, `Matéria <hex8>`) e enunciado-sentinela escrito pelos testes.
 * Uma questão real de prova não se chama "P?" nem pendura num
 * `knowledge_subjects` chamado `E2E …`.
 */

/** Prefixos de enunciado escritos por teste, em caixa normalizada. */
export const PREFIXOS_ENUNCIADO_FIXTURA = ["E2E "] as const;

/** Enunciados-sentinela exatos das fixturas de integração. */
export const ENUNCIADOS_FIXTURA = ["Qual é a pergunta?", "P?"] as const;

/** Nomes de matéria gerados pelos testes: `E2E a1b2c3d4`, `Matéria a1b2c3d4`. */
const PADRAO_NOME_FIXTURA = /^(e2e|mat[ée]ria)\s+[0-9a-f-]{8}$/i;

/** Slugs correspondentes: `e2e-a1b2c3d4`, `materia-a1b2c3d4`. */
const PADRAO_SLUG_FIXTURA = /^(e2e|materia)-[0-9a-f-]{8}$/i;

export function ehEnunciadoDeFixtura(enunciado: string | null | undefined): boolean {
  if (!enunciado) return false;
  const texto = enunciado.trim();
  if ((ENUNCIADOS_FIXTURA as readonly string[]).includes(texto)) return true;
  return PREFIXOS_ENUNCIADO_FIXTURA.some((p) => texto.toUpperCase().startsWith(p.toUpperCase()));
}

export function ehNomeDeFixtura(nome: string | null | undefined): boolean {
  if (!nome) return false;
  return PADRAO_NOME_FIXTURA.test(nome.trim());
}

export function ehSlugDeFixtura(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return PADRAO_SLUG_FIXTURA.test(slug.trim());
}

/** Uma linha de catálogo é fixtura quando nome ou slug denunciam teste. */
export function ehMateriaDeFixtura(linha: { name?: string | null; slug?: string | null }): boolean {
  return ehNomeDeFixtura(linha.name) || ehSlugDeFixtura(linha.slug);
}
