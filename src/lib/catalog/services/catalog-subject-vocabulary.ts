/**
 * Vocabulario canonico de assuntos (docs/23 #4), declarado em codigo e nao em
 * banco: ainda nao existe tabela de mapeamento e toda escrita em banco esta
 * bloqueada por decisao de projeto. Alias servem apenas para a RESOLUCAO de
 * assunto no catalog-matcher, nunca para renomear linha canonica:
 * uq_knowledge_subjects_name compara o nome bruto, e renomear criaria identidade
 * nova, abrindo espaco para a grafia antiga voltar como materia duplicada.
 *
 * Cada alvo foi conferido no snapshot de leitura-only
 * (database/knowledge/snapshots/2026-10-03-catalogo-atual.json): se o alvo nao
 * existir como assunto canônico ativo, o matcher continua em SUBJ-03 e a linha
 * fica BLOQUEADO - alias nao inventa catalogo.
 *
 * A terceira linha da tabela de docs/23 (#4: "Raciocinio Logico ainda nao existe
 * como linha") esta desatualizada contra o snapshot atual: a linha existe, com
 * slug raciocinio-logico e status active. Por isso o cabecalho publicado casa
 * direto por SUBJ-01 e nao entra aqui como alias.
 */
import type { CatalogSubjectAlias } from "../types/catalog-ingestion";
/**
 * Cabecalho publicado no edital -> assunto canonico do snapshot. Os nomes são
 * literais sem acento de proposito: o matcher compara por normalizeTopicName,
 * que degrava e unifica caixa, entao a grafia do arquivo-fonte nao depende de
 * acentuacao. O nome canônico persistido continua sendo o do snapshot (Português),
 * nunca o do alias.
 */
export const CANONICAL_SUBJECT_ALIASES: CatalogSubjectAlias[] = [
  {
    publishedName: "Lingua Portuguesa",
    canonicalSubjectName: "Portugues",
    rule: "docs/23 #4: disciplina publicada com nome que difere do assunto canonico",
  },
  {
    publishedName: "Matematica e Raciocinio Logico",
    canonicalSubjectName: "Matematica",
    rule: "docs/23 #4: disciplina unica publicada que agrega dois assuntos",
  },
];
/**
 * Cabecalhos publicados que ainda nao tem assunto canonico correspondente. Serve
 * de registro para o revisor humano (docs/23 #5.3): nada aqui autoriza forçar um
 * alvo - essas linhas continuam SUBJ-03/BLOQUEADO ate decisao revisada.
 */
export const UNMAPPED_PUBLISHED_SUBJECTS: string[] = [
  "Conhecimentos Especificos",
  "Conhecimentos Basicos",
];