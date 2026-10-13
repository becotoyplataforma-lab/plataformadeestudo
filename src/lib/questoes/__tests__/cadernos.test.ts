/**
 * Testes do catálogo de cadernos.
 *
 * O que está em jogo aqui é nomenclatura com conseqüência: se rota, menu ou
 * filtro voltarem a carregar o nome do arquivo físico, o acoplamento com a
 * "aula 14" volta pela porta dos fundos. Estes casos travam isso sem depender de
 * banco nem de disco.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  CADERNOS,
  CHAVES_FILTRO,
  FILTRO_VAZIO,
  alternarFiltro,
  aplicarFiltros,
  cadernoPorSlug,
  calcularPagina,
  contagemDaFaceta,
  contagemPorAssunto,
  facetas,
  fatiarPagina,
  filtroEstaVazio,
  itensDeMenu,
  janelaDePaginas,
  lerFiltros,
  normalizar,
  queryDeFiltros,
  queryDePagina,
  removerCopiasIdenticas,
  resolverRef,
  rotuloDaTag,
  semFaceta,
  tagsDoItem,
  type Caderno,
  type FiltrosCaderno,
  type ItemCaderno,
} from "../cadernos";
import { rotasQuestoes } from "../rotas";
import type { QuestaoExtraida } from "../procedencia";

const LOTE = CADERNOS[0]!.lotes[0]!;

function questao(sob: Partial<QuestaoExtraida> = {}): QuestaoExtraida {
  return {
    id_local: "A14-S01-001",
    codigo: "A14-S01-001",
    aula: 14,
    secao: 1,
    secao_tipo: "comentada",
    secao_rotulo: "Questões Comentadas - Ortografia",
    grupo: 1,
    numero_na_secao: 1,
    numero_original: 1,
    tema: "Ortografia",
    assunto: "Ortografia",
    disciplina: "Língua Portuguesa",
    alvo_apostila: "CBM-PE (Soldado)",
    banca: "INOVERSASUL",
    orgao: null,
    cargo: "PROFESSOR",
    ano: 2025,
    nivel: null,
    tipo: "certo_errado",
    enunciado: "Enunciado.",
    alternativas: { C: "Certo", E: "Errado" },
    gabarito: "E",
    gabarito_original: "E",
    gabarito_metodo: "palavra",
    origem_gabarito: "comentario",
    doador_gabarito: null,
    pagina_pdf: 4,
    page_refs: [4, 4],
    content_hash: "abc",
    body_hash: "def",
    duplicata_de: null,
    proveniencia: {
      estado: "oficial_prova",
      origem_gabarito: "comentario",
      doador_gabarito: null,
      classificacao_tag: "banca/cargo/ano",
      tag_crua: null,
      paginas: [4, 4],
      secao: 1,
      grupo: 1,
      numero_original: 1,
      editado_por_humano: false,
    },
    provenance_status: "oficial_prova",
    quarantined: false,
    status: "em_revisao",
    origin: "import",
    resolucao_status: "pendente_geracao",
    isPublic: false,
    explicacao: null,
    links: { teoria: null, questao: null, fonte_pdf: null },
    avisos: [],
    ...sob,
  };
}

function item(sob: Partial<QuestaoExtraida> = {}): ItemCaderno {
  return { questao: questao(sob), lote: LOTE };
}

/** Item distinto por posição, para os casos que precisam de várias questões. */
function itemEm(n: number, sob: Partial<QuestaoExtraida> = {}): ItemCaderno {
  const codigo = `A14-S01-${String(n).padStart(3, "0")}`;
  return item({ id_local: codigo, codigo, content_hash: `hash-${n}`, ...sob });
}
describe("catálogo de cadernos", () => {
  it("cada caderno tem slug único e é resolvido por ele", () => {
    const slugs = CADERNOS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(cadernoPorSlug("portugues")?.materia).toBe("Português");
    expect(cadernoPorSlug("nao-existe")).toBeNull();
    expect(cadernoPorSlug("")).toBeNull();
  });

  it("o rótulo navegável não menciona número de aula nem concurso", () => {
    for (const caderno of CADERNOS) {
      expect(caderno.titulo).not.toMatch(/aula\s*\d+/i);
      expect(caderno.titulo).not.toMatch(/cbm-/i);
      expect(caderno.subtitulo).not.toMatch(/aula\s*\d+/i);
    }
  });

  it("a aula vive só em procedência, como tag de filtro", () => {
    const portugues = cadernoPorSlug("portugues")!;
    expect(portugues.lotes.map((l) => l.origem)).toContain("aula-14");
    expect(portugues.lotes[0]!.arquivo).toContain("aula_14");
    expect(portugues.materiaPublicada).toBe("Língua Portuguesa");
    // e ainda assim o href do menu é o caderno da matéria
    expect(itensDeMenu()[0]!.href).toBe(rotasQuestoes.caderno("portugues"));
    expect(itensDeMenu()[0]!.label).toBe("Português · Banco de Questões");
  });

  it("menu é derivado: sem lote local não há badge de revisão", () => {
    const semLote = [{ ...CADERNOS[0]!, lotes: [] }];
    expect(itensDeMenu(semLote)[0]!.badge).toBeUndefined();
  });

  it("matéria nova é linha no catálogo, não código novo", () => {
    // A decisão de produto está em docs/31: o caderno é da matéria, e o catálogo
    // precisa receber Direito, Informática e Raciocínio Lógico sem tocar em
    // rota, menu ou componente. Uma entrada a mais tem de virar rota e item de
    // menu sozinha — se isto exigir código novo, a abstração está errada.
    const catalogo: Caderno[] = [
      ...CADERNOS,
      {
        slug: "direito",
        materia: "Direito",
        materiaPublicada: null,
        titulo: "Direito · Banco de Questões",
        subtitulo: "Caderno de treino de Direito.",
        lotes: [
          {
            origem: "apostila-01",
            arquivo: "questoes_apostila_01.json",
            descricao: "Apostila 1 · 9 assuntos",
          },
        ],
      },
    ];

    const menu = itensDeMenu(catalogo);
    expect(menu).toHaveLength(CADERNOS.length + 1);
    expect(menu.map((m) => m.href)).toEqual([
      rotasQuestoes.caderno("portugues"),
      rotasQuestoes.caderno("direito"),
    ]);
    expect(menu.map((m) => m.badge)).toEqual(["Revisão", "Revisão"]);
  });
});

describe("resolverRef (/questoes/[ref])", () => {
  it("resolve por forma, sem consultar fonte alguma", () => {
    expect(resolverRef("portugues")).toEqual({ tipo: "caderno", caderno: CADERNOS[0] });
    expect(resolverRef("A14-S01-007")).toEqual({ tipo: "questao-lote", codigo: "A14-S01-007" });
    expect(resolverRef("8f14e45f-eea6-4c5b-8b7d-2f6b1a2c3d4e")).toEqual({
      tipo: "questao-banco",
      id: "8f14e45f-eea6-4c5b-8b7d-2f6b1a2c3d4e",
    });
    expect(resolverRef("pedagogia")).toBeNull();
    expect(resolverRef("A14-S1-7")).toBeNull();
  });
});

describe("leitura de filtros da URL", () => {
  it("lerFiltros tolera objeto cru, vetor e lixo numérico", () => {
    expect(lerFiltros({ assunto: "Pontuação", ano: "2019" })).toMatchObject({
      assunto: "Pontuação",
      ano: 2019,
    });
    expect(lerFiltros({ assunto: ["A", "B"] }).assunto).toBe("A");
    expect(lerFiltros({ ano: "abc" }).ano).toBeNull();
    expect(lerFiltros({ assunto: "   " })).toEqual(FILTRO_VAZIO);
    expect(lerFiltros(new URLSearchParams("banca=FGV&tipo=certo_errado"))).toMatchObject({
      banca: "FGV",
      tipo: "certo_errado",
    });
    expect(filtroEstaVazio(FILTRO_VAZIO)).toBe(true);
  });

  it("queryDeFiltros é determinística na ordem das chaves", () => {
    const f: FiltrosCaderno = {
      assunto: "Pontuação",
      disciplina: null,
      banca: null,
      ano: 2019,
      origem: "aula-14",
      tipo: null,
      gabarito: null,
    };
    const q = queryDeFiltros(f);
    // Ordem = CHAVES_FILTRO. Não se afirma a forma exata do percent-encoding:
    // o que tem que continuar valendo é a ordem e o round-trip, que é o que a
    // barra de filtros usa para montar link compartilhável.
    expect(q.startsWith("assunto=")).toBe(true);
    expect(q).toContain("ano=2019");
    expect(q).toContain("origem=aula-14");
    expect(q.indexOf("ano=2019")).toBeLessThan(q.indexOf("origem=aula-14"));
    expect(q).not.toContain("banca=");
    expect(q).not.toContain("tipo=");
    expect(lerFiltros(new URLSearchParams(q))).toEqual(f);
    expect(queryDeFiltros(lerFiltros({ assunto: "Ortografia" }))).toBe("assunto=Ortografia");
  });

  it("alternarFiltro desliga a tag já ativa", () => {
    const ligado = alternarFiltro(FILTRO_VAZIO, "origem", "aula-14");
    expect(ligado.origem).toBe("aula-14");
    expect(alternarFiltro(ligado, "origem", "aula-14").origem).toBeNull();
    expect(alternarFiltro(FILTRO_VAZIO, "ano", "2019").ano).toBe(2019);
  });
});

describe("aplicação de filtros sobre o lote", () => {
  it("igualdade normalizada: grafia e caixa do PDF não duplicam faceta", () => {
    expect(normalizar("Funções Sintáticas")).toBe(normalizar("Funções sintáticas"));
    const itens = [
      item({ assunto: "Funções Sintáticas" }),
      item({ assunto: "Funções sintáticas", id_local: "A14-S01-002", codigo: "A14-S01-002" }),
      item({ assunto: "Pontuação", id_local: "A14-S01-003", codigo: "A14-S01-003" }),
    ];
    expect(aplicarFiltros(itens, lerFiltros({ assunto: "funções sintáticas" }))).toHaveLength(2);
  });

  it("disciplina filtra o nível acima do assunto", () => {
    const itens = [
      item({ disciplina: "Língua Portuguesa" }),
      item({ disciplina: "Matemática", id_local: "A14-S01-002", codigo: "A14-S01-002" }),
    ];
    expect(aplicarFiltros(itens, lerFiltros({ disciplina: "língua portuguesa" }))).toHaveLength(1);
    expect(aplicarFiltros(itens, lerFiltros({ disciplina: "Raciocínio Lógico" }))).toHaveLength(0);
    const query = queryDeFiltros(lerFiltros({ disciplina: "Matemática" }));
    expect(query).toContain("disciplina=");
    expect(lerFiltros(new URLSearchParams(query)).disciplina).toBe("Matemática");
  });

  it("filtra por tipo, banca, ano e origem; tag inexistente devolve vazio", () => {
    const itens = [
      item({ tipo: "certo_errado" }),
      item({
        tipo: "multipla_escolha",
        id_local: "A14-S01-002",
        codigo: "A14-S01-002",
        banca: "VUNESP",
      }),
    ];
    expect(aplicarFiltros(itens, lerFiltros({ tipo: "multipla_escolha" }))).toHaveLength(1);
    expect(aplicarFiltros(itens, lerFiltros({ banca: "vunesp" }))).toHaveLength(1);
    expect(aplicarFiltros(itens, lerFiltros({ ano: "2025" }))).toHaveLength(2);
    expect(aplicarFiltros(itens, lerFiltros({ ano: "1999" }))).toHaveLength(0);
    expect(aplicarFiltros(itens, lerFiltros({ origem: "aula-14" }))).toHaveLength(2);
    expect(aplicarFiltros(itens, lerFiltros({ origem: "aula-99" }))).toHaveLength(0);
    expect(aplicarFiltros(itens, FILTRO_VAZIO)).toHaveLength(2);
  });

  it("tagsDoItem espelha o que o card mostra como selo", () => {
    expect(tagsDoItem(item())).toMatchObject({
      assunto: "Ortografia",
      disciplina: "Língua Portuguesa",
      banca: "INOVERSASUL",
      ano: "2025",
      origem: "aula-14",
      tipo: "certo_errado",
      gabarito: "confiavel",
    });
    // Item em quarentena ou sem resposta nunca carrega a tag de confiança.
    expect(tagsDoItem(item({ quarantined: true })).gabarito).toBeNull();
    expect(tagsDoItem(item({ gabarito: null })).gabarito).toBeNull();
  });

  it("gabarito=confiavel é filtro de qualidade, com valor fechado", () => {
    expect(lerFiltros({ gabarito: "confiavel" }).gabarito).toBe("confiavel");
    expect(lerFiltros({ gabarito: "mais-ou-menos" }).gabarito).toBeNull();
    expect(alternarFiltro(FILTRO_VAZIO, "gabarito", "confiavel").gabarito).toBe("confiavel");

    const itens = [
      item(),
      item({ quarantined: true, id_local: "A14-S01-002", codigo: "A14-S01-002" }),
      item({ gabarito: null, id_local: "A14-S01-003", codigo: "A14-S01-003" }),
    ];
    expect(aplicarFiltros(itens, lerFiltros({ gabarito: "confiavel" }))).toHaveLength(1);
    // Combinado com outra tag, os predicados se acumulam (E), nunca se ignoram.
    expect(
      aplicarFiltros(itens, lerFiltros({ gabarito: "confiavel", assunto: "Ortografia" }))
    ).toHaveLength(1);
    expect(
      aplicarFiltros(itens, lerFiltros({ gabarito: "confiavel", assunto: "Pontuação" }))
    ).toHaveLength(0);
  });

  it("facetas saem ordenadas e sem duplicata de grafia", () => {
    const f = facetas([
      item({ assunto: "Pontuação", tipo: "multipla_escolha" }),
      item({ assunto: "pontuação", id_local: "A14-S01-002", codigo: "A14-S01-002", ano: 2019 }),
      item({ assunto: "Ortografia", id_local: "A14-S01-003", codigo: "A14-S01-003", banca: null }),
    ]);
    expect(f.assunto.filter((a) => normalizar(a) === "pontuacao")).toHaveLength(1);
    expect(f.disciplina).toEqual(["Língua Portuguesa"]);
    expect(f.ano).toEqual([2019, 2025]);
    expect(f.origem).toEqual(["aula-14"]);
    expect(f.banca).toEqual(["INOVERSASUL"]);
    expect(f.tipo).toEqual(["certo_errado", "multipla_escolha"]);
  });

  it("disciplina permanece na barra com valor único", () => {
    // Um lote de uma matéria só tem uma disciplina, e a barra continuaria certa
    // se a escondesse como "otimização". Ela fica: `disciplina` é o nível acima
    // do assunto e a chave pela qual as próximas matérias entram no catálogo.
    // Esconder a faceta enquanto há uma matéria só trocaria o contrato por
    // conveniência de hoje (docs/31 §7.2).
    expect(CHAVES_FILTRO).toContain("disciplina");
    expect(facetas([item({ disciplina: "Língua Portuguesa" })]).disciplina).toEqual([
      "Língua Portuguesa",
    ]);
    // ...e com duas matérias a faceta separa as duas sem duplicar grafia
    const duas = [
      item({ disciplina: "Língua Portuguesa" }),
      item({
        disciplina: "lingua portuguesa",
        id_local: "A14-S01-002",
        codigo: "A14-S01-002",
      }),
    ];
    expect(
      facetas(duas).disciplina.filter((d) => normalizar(d) === "lingua portuguesa")
    ).toHaveLength(1);
  });

  it("contagemPorAssunto ordena do maior para o menor", () => {
    const c = contagemPorAssunto([
      item({ assunto: "Pontuação" }),
      item({ assunto: "Pontuação", id_local: "A14-S01-002", codigo: "A14-S01-002" }),
      item({ assunto: "Ortografia", id_local: "A14-S01-003", codigo: "A14-S01-003" }),
    ]);
    expect(c[0]).toEqual({ assunto: "Pontuação", total: 2 });
  });

  it("rótulo legível não vaza chave interna", () => {
    expect(rotuloDaTag("origem", "aula-14")).toBe("Aula 14");
    expect(rotuloDaTag("tipo", "certo_errado")).toBe("Certo/Errado");
    expect(rotuloDaTag("assunto", "Pontuação")).toBe("Pontuação");
  });
});

describe("cópia canônica do acervo", () => {
  it("colapsa a questão publicada duas vezes no mesmo PDF", () => {
    const comentada = item({ content_hash: "h1" });
    const lista = item({
      content_hash: "h1",
      secao_tipo: "lista",
      gabarito: null,
      id_local: "A14-S09-001",
      codigo: "A14-S09-001",
    });
    const outra = itemEm(2, { content_hash: "h2" });

    const acervo = removerCopiasIdenticas([lista, comentada, outra]);

    expect(acervo).toMatchObject({ linhas: 3, duplicatas: 1, semGabaritoConfiavel: 0 });
    // Uma linha por conteúdo, na ordem da primeira aparição…
    expect(acervo.itens.map((i) => i.questao.id_local)).toEqual(["A14-S01-001", "A14-S01-002"]);
    // …mas sobrevive a cópia comentada, que é a que traz o contexto do material.
    expect(acervo.itens[0]!.questao.secao_tipo).toBe("comentada");
  });

  it("prefere a cópia cujo gabarito o material sustenta", () => {
    const semResposta = itemEm(1, { content_hash: "h1", gabarito: null });
    const comResposta = item({ content_hash: "h1", id_local: "A14-S09-001", codigo: "A14-S09-001" });
    const acervo = removerCopiasIdenticas([semResposta, comResposta]);
    expect(acervo.itens).toHaveLength(1);
    expect(acervo.itens[0]!.questao.id_local).toBe("A14-S09-001");
  });

  it("linha sem firma de conteúdo não se funde com a vizinha", () => {
    const acervo = removerCopiasIdenticas([itemEm(1, { content_hash: "" }), itemEm(2, { content_hash: "" })]);
    expect(acervo.itens).toHaveLength(2);
    expect(acervo.duplicatas).toBe(0);
  });

  it("semGabaritoConfiavel conta as distintas problemáticas", () => {
    const acervo = removerCopiasIdenticas([
      itemEm(1, { content_hash: "h1" }),
      itemEm(2, { content_hash: "h2", quarantined: true }),
      itemEm(3, { content_hash: "h3", gabarito: null }),
    ]);
    expect(acervo.itens).toHaveLength(3);
    expect(acervo.semGabaritoConfiavel).toBe(2);
  });

  it("o corte da página vem depois de deduplicar, nunca antes", () => {
    const dupla = [item({ content_hash: "h1" }), item({ content_hash: "h1", secao_tipo: "lista", id_local: "A14-S09-001", codigo: "A14-S09-001" })];
    expect(aplicarFiltros(removerCopiasIdenticas(dupla).itens, FILTRO_VAZIO)).toHaveLength(1);
  });
});

describe("contagem de faceta", () => {
  it("banca ordena por ocorrência e conserva a grafia do material", () => {
    const itens = [
      item({ banca: "FGV" }),
      itemEm(2, { banca: "fgv" }),
      itemEm(3, { banca: "INOVERSASUL" }),
      itemEm(4, { banca: null }),
    ];
    expect(contagemDaFaceta(itens, "banca")).toEqual([
      { valor: "FGV", total: 2 },
      { valor: "INOVERSASUL", total: 1 },
    ]);
    // A lacuna é medida, não escondida: no lote real muitas questões não declaram banca.
    expect(semFaceta(itens, "banca")).toBe(1);
  });

  it("ano sai do mais recente para o mais antigo", () => {
    const itens = [item({ ano: 2019 }), itemEm(2, { ano: 2025 }), itemEm(3, { ano: null })];
    expect(contagemDaFaceta(itens, "ano")).toEqual([
      { valor: "2025", total: 1 },
      { valor: "2019", total: 1 },
    ]);
    expect(semFaceta(itens, "ano")).toBe(1);
  });

  it("modalidade usa o rótulo legível, não a chave interna", () => {
    const itens = [item({ tipo: "certo_errado" }), itemEm(2, { tipo: "multipla_escolha" })];
    expect(contagemDaFaceta(itens, "tipo").map((o) => o.valor)).toEqual([
      "certo_errado",
      "multipla_escolha",
    ]);
    expect(rotuloDaTag("tipo", "multipla_escolha")).toBe("Múltipla escolha");
  });
});

describe("paginação por URL", () => {
  it("amarra page e por ao total real, sem chutar", () => {
    expect(calcularPagina({ page: "3" }, 920)).toMatchObject({
      atual: 3,
      porPagina: 20,
      totalPaginas: 46,
      inicio: 41,
      fim: 60,
    });
    // Página acima do último intervalo é cortada para a última, não para a 1.
    expect(calcularPagina({ page: "999" }, 920).atual).toBe(46);
    expect(calcularPagina({ page: "0" }, 920).atual).toBe(1);
    expect(calcularPagina({ page: "abc" }, 920).atual).toBe(1);
    // Tamanho fora da lista fechada não vira vetor de ataque ao carregar o lote.
    expect(calcularPagina({ por: "500" }, 920).porPagina).toBe(20);
    expect(calcularPagina({ por: "50" }, 920)).toMatchObject({ porPagina: 50, totalPaginas: 19 });
    expect(calcularPagina({}, 0)).toMatchObject({ totalPaginas: 1, inicio: 0, fim: 0 });
  });

  it("fatiarPagina devolve o recorte exato da última página", () => {
    const itens = Array.from({ length: 41 }, (_, i) => `q${i + 1}`);
    expect(fatiarPagina(itens, calcularPagina({}, 41))).toHaveLength(20);
    expect(fatiarPagina(itens, calcularPagina({ page: "3" }, 41))).toEqual(["q41"]);
    expect(fatiarPagina(itens, calcularPagina({}, 0))).toEqual([]);
  });

  it("queryDePagina preserva filtros e omite o que é padrão", () => {
    const filtros = lerFiltros({ assunto: "Pontuação", banca: "FGV" });
    // page=1 não entra na URL: o link limpo continua sendo o canônico.
    expect(queryDePagina(filtros, calcularPagina({}, 920))).toBe(queryDeFiltros(filtros));
    const segunda = queryDePagina(filtros, calcularPagina({ page: "2" }, 920));
    expect(segunda).toContain("page=2");
    // Round-trip: quem abre o link recebe o filtro e a página de volta.
    expect(lerFiltros(new URLSearchParams(segunda))).toEqual(filtros);
    expect(queryDePagina(filtros, calcularPagina({ por: "50" }, 920))).toContain("por=50");
  });

  it("janelaDePaginas nunca virou régua com as 46 páginas do lote", () => {
    expect(janelaDePaginas(1, 46)).toEqual([1, 2, 3, 46]);
    expect(janelaDePaginas(23, 46)).toEqual([1, 21, 22, 23, 24, 25, 46]);
    expect(janelaDePaginas(46, 46)).toEqual([1, 44, 45, 46]);
    expect(janelaDePaginas(2, 3)).toEqual([1, 2, 3]);
    expect(janelaDePaginas(1, 1)).toEqual([1]);
  });
});

describe("redirects legados (next.config.ts)", () => {
  const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf-8");

  it("a trilha antiga do PDF cai no caderno da matéria", () => {
    expect(config).toContain(`destination: "${rotasQuestoes.caderno("portugues")}"`);
    expect(config).toContain('source: "/cbm-rj/portugues/questoes/aula-14/:codigo"');
    expect(config).toContain('destination: "/questoes/:codigo"');
    // Parâmetro opcional quebra em runtime no Next 16: a forma antiga não pode
    // voltar, sob pena de o link histórico virar 500. A checagem é por padrão de
    // linha de redirect, não por texto solto, para não depender da prosa.
    expect(config).not.toMatch(/(source|destination):\s*"[^"]*\?/);
  });

  it("nenhum destino de redirect menciona aula", () => {
    const destinos = [...config.matchAll(/destination:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(destinos.length).toBeGreaterThan(0);
    for (const destino of destinos) expect(destino).not.toMatch(/aula-\d+/);
  });
});

