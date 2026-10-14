/**
 * ConcursoAI — Tipos e regras de procedência das questões extraídas.
 *
 * A extração (agents/pdf_question_extractor) escreve um JSON por fora do banco.
 * Este módulo é a leitura honesta desse JSON: o que o PDF não disse chega como
 * `null`, e nada aqui "completa" metadado.
 *
 * Reproduz, do lado do TypeScript, as invariantes que o extrator garante:
 * - `gabarito` é sempre letra (A–E); nunca palavra por extenso;
 * - item Certo/Errado vem com as alternativas sintéticas `C: Certo` / `E: Errado`;
 * - `explicacao` é sempre `null` (comentário de terceiro fica só no arquivo LOCAL);
 * - `status` começa em `em_revisao` e `isPublic` em `false`.
 */

export type TipoItem = "multipla_escolha" | "certo_errado";

export type EstadoProcedencia =
  | "oficial_prova"
  | "inedita_compilador"
  | "gabarito_inconclusivo"
  | "estrutura_incompleta"
  | "revisao_pendente";

export type StatusResolucao = "pendente_geracao" | "gerada" | "revisada";

export interface Proveniencia {
  estado: EstadoProcedencia;
  origem_gabarito: string | null;
  doador_gabarito: string | null;
  classificacao_tag: string | null;
  tag_crua: string | null;
  paginas: [number, number] | number[];
  secao: number;
  grupo: number;
  numero_original: number;
  editado_por_humano: boolean;
}

export interface QuestaoExtraida {
  id_local: string;
  codigo: string;
  aula: number;
  secao: number;
  secao_tipo: "comentada" | "lista";
  secao_rotulo: string;
  grupo: number;
  numero_na_secao: number;
  numero_original: number;
  tema: string;
  assunto: string;
  disciplina: string;
  alvo_apostila: string;
  banca: string | null;
  orgao: string | null;
  cargo: string | null;
  ano: number | null;
  nivel: string | null;
  tipo: TipoItem;
  enunciado: string;
  alternativas: Record<string, string>;
  gabarito: string | null;
  gabarito_original: string | null;
  gabarito_metodo: string | null;
  origem_gabarito: string;
  doador_gabarito: string | null;
  pagina_pdf: number;
  page_refs: number[];
  content_hash: string;
  body_hash: string;
  duplicata_de: string | null;
  proveniencia: Proveniencia;
  provenance_status: EstadoProcedencia;
  quarantined: boolean;
  status: string;
  origin: string;
  resolucao_status: StatusResolucao;
  isPublic: boolean;
  explicacao: null;
  links: { teoria: string | null; questao: string | null; fonte_pdf: string | null };
  avisos: string[];
}

/** Alternativas ordenadas, com a letra que o importador usaria. */
export function alternativasOrdenadas(q: QuestaoExtraida): { letra: string; texto: string }[] {
  return Object.entries(q.alternativas)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letra, texto]) => ({ letra, texto }));
}

/**
 * O gabarito pode ser mostrado? Só se a questão passou na extração.
 *
 * Uma questão em quarentena (gabarito ausente, anulado, em conflito entre o
 * comentário e o bloco GABARITO, ou divergente entre cópias) não tem resposta
 * confiável: a UI mostra o motivo em vez de chutar um "certo/errado".
 */
export function gabaritoConfiavel(q: QuestaoExtraida): boolean {
  return !q.quarantined && typeof q.gabarito === "string" && q.gabarito.length === 1;
}

/**
 * O material anulou a questão? O extrator registra isso de duas formas, e as
 * duas são leitura do PDF: `gabarito_metodo === "anulada"` quando a palavra
 * "anulada" aparece como resposta, e o aviso `gabarito_anulado` quando a anulação
 * vem do bloco de gabaritos. Nenhum dos dois é inferência da UI.
 */
export function ehAnulada(q: QuestaoExtraida): boolean {
  return q.gabarito_metodo === "anulada" || q.avisos.includes("gabarito_anulado");
}

/**
 * Questão que o próprio material declara como de sua autoria, não de prova
 * (estado `inedita_compilador`, já declarado em `SELO_PROCEDENCIA`). No lote de
 * hoje nenhum item o carrega — por isso a caixa "Inéditas" não aparece na barra,
 * e `cadernos.test.ts` cobre o predicado com fixtura.
 */
export function ehInedita(q: QuestaoExtraida): boolean {
  return q.provenance_status === "inedita_compilador" || q.proveniencia.estado === "inedita_compilador";
}

export const LABEL_GABARITO: Record<string, string> = {
  C: "Certo",
  E: "Errado",
};

export function rotuloGabarito(q: QuestaoExtraida): string | null {
  if (!gabaritoConfiavel(q) || !q.gabarito) return null;
  if (q.tipo === "certo_errado") return LABEL_GABARITO[q.gabarito] ?? q.gabarito;
  return q.gabarito;
}

/**
 * Trilha de metadados no padrão de leitura do Qconcursos:
 * `Banca · Ano ▸ Disciplina ▸ Assunto ▸ Órgão`.
 *
 * Um selo só existe se o material declarou aquele valor. `banca` está ausente
 * em 906 dos 1.736 itens públicos do dataset; preencher com "Sem banca"
 * transformaria uma lacuna do PDF em metadado, então o selo simplesmente não
 * aparece. `cargo` e `ano` continuam visíveis na sanfona de procedência.
 */
export type ChaveSelo = "banca_ano" | "disciplina" | "assunto" | "orgao";

export interface SeloMetadados {
  chave: ChaveSelo;
  texto: string;
}

export function selosMetadados(q: QuestaoExtraida): SeloMetadados[] {
  const selos: SeloMetadados[] = [];
  const bancaAno = [q.banca, q.ano ? String(q.ano) : null]
    .filter((v): v is string => Boolean(v))
    .join(" · ");
  if (bancaAno) selos.push({ chave: "banca_ano", texto: bancaAno });
  if (q.disciplina) selos.push({ chave: "disciplina", texto: q.disciplina });
  if (q.assunto) selos.push({ chave: "assunto", texto: q.assunto });
  if (q.orgao) selos.push({ chave: "orgao", texto: q.orgao });
  return selos;
}

/**
 * Texto plano da trilha (usado no `title`, onde a ordem completa cabe).
 * Derivado de `selosMetadados` para as duas leituras nunca divergirem.
 */
export function trilhaMetadados(q: QuestaoExtraida): string[] {
  return selosMetadados(q).map((s) => s.texto);
}

/** Selo legível do estado de procedência. */
export const SELO_PROCEDENCIA: Record<EstadoProcedencia, string> = {
  oficial_prova: "Prova anterior",
  inedita_compilador: "Inédita do compilador",
  gabarito_inconclusivo: "Gabarito inconclusivo",
  estrutura_incompleta: "Estrutura incompleta",
  revisao_pendente: "Revisão pendente",
};

export const MOTIVO_PROCEDENCIA: Record<EstadoProcedencia, string> = {
  oficial_prova: "Banca e ano declarados no material.",
  inedita_compilador:
    "O próprio material declara que o item é de autoria dele, não cai em prova.",
  gabarito_inconclusivo:
    "O material não dá uma resposta confiável para este item (ausente, anulado ou em conflito).",
  estrutura_incompleta: "Falta enunciado ou alternativas suficientes para existir no banco.",
  revisao_pendente: "Extraído, mas ainda não conferido por humano.",
};
