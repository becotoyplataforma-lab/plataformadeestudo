/**
 * Fixture de NOVO CURSO (FASE 4B).
 *
 * Edital pequeno e controlado de um concurso diferente do CBMERJ, escrito aqui sem
 * baixar nada nem tocar internet. Cada linha existe para provar um comportamento do
 * agente, e a fixture declara o que cada linha deve produzir:
 *
 *   - disciplina que ja existe como assunto canonico (Lingua Portuguesa -> Portugues,
 *     resolvido pelo vocabulario de docs/23 #4, sem alias do caller);
 *   - topico canonico existente (Pontuacao, Semantica) -> REUSO_CANONICO;
 *   - topico semanticamente proximo de um canonico (Classes de Palavras, vizinho de
 *     "Morfologia (Classes de Palavras)") -> NOVO_CANONICO com nearMiss;
 *   - topico claramente novo (Editores de texto, assunto canonico sem cobertura)
 *     -> NOVO_CANONICO por TOPIC-05;
 *   - colisoes: mesmo nome normalizado, diferenca so de pontuacao, diferenca so de
 *     caixa, mesmo slug com nome diferente e ordinal publicado de duas formas;
 *   - disciplina inexistente no catalogo (Legislacao Municipal) -> BLOQUEADO SUBJ-03;
 *   - fragmento derivado de rotulo -> PENDENTE_REVISAO (nunca reuso).
 *
 * Os marcadores "===== PAGE n =====" sao o artefato de captura que o validador da
 * FASE 4 ja conhece, e a linha de disciplina carrega peso publicado para exercitar a
 * extracao de fatos de edital.
 */
import type { CatalogAgentContestInput, CatalogAgentSourceInput } from "../../types/catalog-agent";

const L = "L\u00EDngua Portuguesa";
const PT = "Pontua\u00E7\u00E3o";
const PT_VIRGULA_PAREN = "Pontua\u00E7\u00E3o (v\u00EDrgula)";
const PT_VIRGULA_DASH = "Pontua\u00E7\u00E3o - v\u00EDrgula";
const SEMANTICA = "Sem\u00E2ntica";
const SEMANTICA_UPPER = "SEM\u00C2NTICA";
const ORTOGRAFIA_MIDDOT = "Ortografia \u00B7 Acentua\u00E7\u00E3o";
const ORTOGRAFIA_COMMA = "Ortografia, Acentua\u00E7\u00E3o";
const GRAU_LETTER = "Soldado de 1o Grau";
const GRAU_SYMBOL = "Soldado de 1 \u00BA Grau";

export const NOVO_CURSO_2026_TEXT: string = [
  "===== PAGE 1 =====",
  "CONCURSO P\u00DABLICO: Prefeitura Municipal de Teste",
  "\u00D3rg\u00E3o: Secretaria Municipal de Estudos",
  "Banca: Instituto Avaliador de Testes",
  "N\u00EDvel de escolaridade: M\u00E9dio",
  "Vagas: 40",
  "Quantidade de quest\u00F5es: 60",
  "Data prov\u00E1vel da prova: 08/02/2026",
  "",
  "PROVA OBJETIVA: " + L + " peso 30, " + "Inform\u00E1tica peso 20, " + "Legisla\u00E7\u00E3o Municipal peso 20.",
  "",
  "CONTE\u00DADO PROGRAM\u00C1TICO",
  "AGENTE ADMINISTRATIVO",
  L,
  PT + ": emprego da v\u00EDrgula em per\u00EDodos simples.",
  SEMANTICA + ": sentido das palavras no contexto.",
  "Classes de Palavras: substantivo, adjetivo e verbo.",
  PT_VIRGULA_PAREN + ": empregos da v\u00EDrgula.",
  PT_VIRGULA_DASH + ": empregos da v\u00EDrgula.",
  SEMANTICA_UPPER + ": sentido das palavras no contexto.",
  "",
  "Inform\u00E1tica",
  ORTOGRAFIA_MIDDOT + ": regras vigentes de escrita.",
  ORTOGRAFIA_COMMA + ": regras vigentes de escrita.",
  "Editores de texto: formata\u00E7\u00E3o b\u00E1sica de documentos.",
  "Planilhas eletr\u00F4nicas: f\u00F3rmulas simples e graficos.",
  "===== PAGE 2 =====",
  "MOTORISTA",
  L,
  GRAU_LETTER + ": conte\u00FAdo da prova do cargo.",
  GRAU_SYMBOL + ": conte\u00FAdo da prova do cargo.",
  "",
  "Legisla\u00E7\u00E3o Municipal",
  "Lei Org\u00E2nica do Munic\u00EDpio: disposi\u00E7\u00F5es preliminares.",
  "Estatuto dos Servidores: direitos e deveres do servidor p\u00FAblico.",
].join("\n");

/** Nomes publicados exatamente como aparecem na fonte, para as afirmacoes abaixo. */
export const NOVO_CURSO_2026_NAMES = {
  disciplinePortugues: L,
  disciplineInformatica: "Inform\u00E1tica",
  disciplineLegislacao: "Legisla\u00E7\u00E3o Municipal",
  topicReuso: PT,
  topicReusoUpper: SEMANTICA_UPPER,
  topicNearMiss: "Classes de Palavras",
  topicNovo: "Editores de texto",
  topicColisaoPontuacao: [PT_VIRGULA_PAREN, PT_VIRGULA_DASH] as const,
  topicColisaoCaixa: [SEMANTICA, SEMANTICA_UPPER] as const,
  topicColisaoSlug: [ORTOGRAFIA_MIDDOT, ORTOGRAFIA_COMMA] as const,
  topicColisaoOrdinal: [GRAU_LETTER, GRAU_SYMBOL] as const,
  topicBloqueado: "Lei Org\u00E2nica do Munic\u00EDpio",
  positions: ["AGENTE ADMINISTRATIVO", "MOTORISTA"] as const,
};

export const NOVO_CURSO_2026_SOURCE: CatalogAgentSourceInput = {
  type: "text",
  content: NOVO_CURSO_2026_TEXT,
  name: "edital-novo-curso-2026.txt",
  label: "Edital de teste - Concurso Municipal de Teste 2026 (fixture local)",
  extractor: "fixture-novo-curso-2026",
  capturedAt: "2026-10-03T00:00:00.000Z",
  reviewedByHuman: true,
};

/**
 * Declaracao do caller sobreposta a uma fonte que publica banca, orgao, nivel, vagas
 * e questoes. O valor declarado NAO pode vencer o fato publicado: e isso que a
 * separacao de camadas em `contest-facts.service.ts` garante.
 */
export const NOVO_CURSO_2026_DECLARED_CONTEST: CatalogAgentContestInput = {
  board: "Banca Declarada Pelo Caller",
  name: "Concurso Municipal de Teste 2026",
};

export const NOVO_CURSO_2026_EXTRACTION = {
  disciplineVocabulary: [L, "Inform\u00E1tica", "Legisla\u00E7\u00E3o Municipal"],
  positionTitles: ["AGENTE ADMINISTRATIVO", "MOTORISTA"],
  includeDerivedTerms: true,
};

/**
 * O que a fixture deve produzir, linha por linha. Os numeros de total sao medidos; a
 * justificativa de cada expected esta na descricao da fixture acima.
 */
export const NOVO_CURSO_2026_EXPECTED = {
  positions: 2,
  distinctDisciplines: 3,
  subjectProposals: 4,
  reused: [PT, SEMANTICA, SEMANTICA_UPPER],
  collisionKinds: [
    "NORMALIZED_NAME",
    "PUNCTUATION_ONLY",
    "CASE_OR_ACCENT_ONLY",
    "SLUG",
    "ORDINAL_KEY_DIVERGENCE",
  ],
  blockedDiscipline: "Legisla\u00E7\u00E3o Municipal",
} as const;