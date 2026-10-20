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
  ABAS_CADERNO,
  CADERNOS,
  CHAVES_DE_CONTAGEM,
  CHAVES_FILTRO,
  FILTROS_TRAVADOS,
  FILTRO_PADRAO,
  PALAVRA_MINIMA,
  ROTULO_DAS_CHAVES,
  alternarFiltro,
  aplicarFiltros,
  cadernoPorSlug,
  calcularPagina,
  chipsDeFiltro,
  contagemDaFaceta,
  contagemPorAssunto,
  ehExercicioDeFixacao,
  facetas,
  fatiarPagina,
  filtroEhPadrao,
  itensDeMenu,
  janelaDePaginas,
  lerFiltros,
  normalizar,
  opcoesDoContexto,
  queryDeFiltros,
  queryDePagina,
  refinamentosDoContexto,
  removerCopiasIdenticas,
  resolverRef,
  rotuloDaTag,
  semAChave,
  semFaceta,
  tagsDoItem,
  totaisDasAbas,
  type Caderno,
  type ChaveFiltro,
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
  it("sem nada na URL a tela já abre no padrão de qualidade", () => {
    // Decisão de produto (docs/31 §7.6): o aluno vê primeiro o gabarito que o
    // material sustenta. `null` não existe mais aqui — `gabarito` e `bloco` têm
    // valor vigente mesmo sem pedido, e é esse valor que a barra reflete.
    expect(lerFiltros({})).toEqual(FILTRO_PADRAO);
    expect(lerFiltros(new URLSearchParams())).toEqual(FILTRO_PADRAO);
    expect(FILTRO_PADRAO.gabarito).toBe("confiavel");
    expect(FILTRO_PADRAO.bloco).toBe("objetivas");
    expect(filtroEhPadrao(lerFiltros({ gabarito: "confiavel" }))).toBe(true);
    expect(filtroEhPadrao(lerFiltros({ bloco: "objetivas" }))).toBe(true);
    expect(filtroEhPadrao(lerFiltros({ gabarito: "todos" }))).toBe(false);
  });

  it("lerFiltros tolera objeto cru, vetor e lixo numérico", () => {
    expect(lerFiltros({ assunto: "Pontuação", ano: "2019" })).toMatchObject({
      assunto: "Pontuação",
      ano: 2019,
    });
    expect(lerFiltros({ assunto: ["A", "B"] }).assunto).toBe("A");
    expect(lerFiltros({ ano: "abc" }).ano).toBeNull();
    expect(lerFiltros({ assunto: "   " })).toEqual(FILTRO_PADRAO);
    expect(lerFiltros(new URLSearchParams("banca=FGV&tipo=certo_errado"))).toMatchObject({
      banca: "FGV",
      tipo: "certo_errado",
    });
  });

  it("palavra-chave só vira filtro com texto que discrimina", () => {
    expect(lerFiltros({ palavra: "crase" }).palavra).toBe("crase");
    expect(lerFiltros({ palavra: "  crase  " }).palavra).toBe("crase");
    // Abaixo do mínimo, ou sem letra nenhuma depois de desacentuar, não entra na
    // URL: um `?palavra=?!` travaria o link compartilhável por nada.
    expect(lerFiltros({ palavra: "a" }).palavra).toBeNull();
    expect(lerFiltros({ palavra: "?!-" }).palavra).toBeNull();
    expect(PALAVRA_MINIMA).toBe(2);
  });

  it("tag fechada: valor que a lista não sabe aplicar volta ao padrão", () => {
    expect(lerFiltros({ gabarito: "confiavel" }).gabarito).toBe("confiavel");
    expect(lerFiltros({ gabarito: "todos" }).gabarito).toBe("todos");
    expect(lerFiltros({ gabarito: "mais-ou-menos" }).gabarito).toBe("confiavel");
    expect(lerFiltros({ bloco: "fixacao" }).bloco).toBe("fixacao");
    expect(lerFiltros({ bloco: "quarentena" }).bloco).toBe("objetivas");
    expect(lerFiltros({ anuladas: "excluir" }).anuladas).toBe("excluir");
    expect(lerFiltros({ anuladas: "sim" }).anuladas).toBeNull();
    expect(lerFiltros({ ineditas: "excluir" }).ineditas).toBe("excluir");
  });

  it("queryDeFiltros é determinística na ordem das chaves", () => {
    const f: FiltrosCaderno = {
      ...FILTRO_PADRAO,
      assunto: "Pontuação",
      ano: 2019,
      origem: "aula-14",
    };
    const q = queryDeFiltros(f);
    // Ordem = CHAVES_FILTRO. Não se afirma a forma exata do percent-encoding:
    // o que tem que continuar valendo é a ordem e o round-trip, que é o que a
    // barra de filtros usa para montar link compartilhável.
    expect(q.startsWith("assunto=")).toBe(true);
    expect(q).toContain("ano=2019");
    expect(q).toContain("origem=aula-14");
    expect(q.indexOf("origem=aula-14")).toBeLessThan(q.indexOf("ano=2019"));
    expect(q).not.toContain("banca=");
    expect(q).not.toContain("tipo=");
    expect(lerFiltros(new URLSearchParams(q))).toEqual(f);
    expect(queryDeFiltros(lerFiltros({ assunto: "Ortografia" }))).toBe("assunto=Ortografia");
  });

  it("o padrão não entra na URL: o link canônico continua limpo", () => {
    // `?gabarito=confiavel` era o filtro explícito de antes; hoje é o que se
    // aplica sem pedir, e escrevê-lo em todo link sujaria histórico e canônico.
    expect(queryDeFiltros(FILTRO_PADRAO)).toBe("");
    expect(queryDeFiltros(lerFiltros({ gabarito: "confiavel" }))).toBe("");
    expect(queryDeFiltros(lerFiltros({ gabarito: "todos" }))).toBe("gabarito=todos");
    expect(queryDeFiltros(lerFiltros({ bloco: "fixacao" }))).toBe("bloco=fixacao");
  });

  it("alternarFiltro desliga a tag já ativa, e desligar é voltar ao padrão", () => {
    const ligado = alternarFiltro(FILTRO_PADRAO, "origem", "aula-14");
    expect(ligado.origem).toBe("aula-14");
    expect(alternarFiltro(ligado, "origem", "aula-14").origem).toBeNull();
    expect(alternarFiltro(FILTRO_PADRAO, "ano", "2019").ano).toBe(2019);
    const comAno = alternarFiltro(FILTRO_PADRAO, "ano", "2019");
    expect(alternarFiltro(comAno, "ano", "2019").ano).toBeNull();
    // As chaves de domínio fechado nunca resultam em `null`: voltam ao valor
    // vigente, senão o "x" do chip levaria a uma tela que a UI não representa.
    const revisao = alternarFiltro(FILTRO_PADRAO, "gabarito", "todos");
    expect(revisao.gabarito).toBe("todos");
    expect(alternarFiltro(revisao, "gabarito", "todos").gabarito).toBe("confiavel");
    const fixacao = alternarFiltro(FILTRO_PADRAO, "bloco", "fixacao");
    expect(fixacao.bloco).toBe("fixacao");
    expect(alternarFiltro(fixacao, "bloco", "fixacao").bloco).toBe("objetivas");
    expect(alternarFiltro(FILTRO_PADRAO, "anuladas", "excluir").anuladas).toBe("excluir");
  });

  it("toda chave tem valor aplicável, rótulo e caminho de volta", () => {
    // Cobertura por chave: filtro novo sem casa em `alternarFiltro` ou sem
    // `ROTULO_DAS_CHAVES` viraria botão morto na barra e chip sem nome.
    const VALOR: Record<ChaveFiltro, string> = {
      disciplina: "Direito",
      assunto: "Pontuação",
<<<<<<< HEAD
      leis: "CF/88",
=======
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
      palavra: "crase",
      banca: "FGV",
      orgao: "TRT - 15ª Região - SP",
      cargo: "Soldado",
<<<<<<< HEAD
      nivel: "superior",
      dificuldade: "medio",
      area_formacao: "direito",
      area_atuacao: "policial",
      origem: "aula-14",
      ano: "2019",
      tipo: "certo_errado",
      status_resolucao: "resolvidas",
      bloco: "fixacao",
      gabarito: "todos",
      desatualizadas: "excluir",
      anuladas: "excluir",
      ineditas: "excluir",
      meus_simulados: "excluir",
      meus_cadernos: "excluir",
      comentado: "sim",
      comentarios: "sim",
      meus_comentarios: "sim",
=======
      origem: "aula-14",
      ano: "2019",
      tipo: "certo_errado",
      bloco: "fixacao",
      gabarito: "todos",
      anuladas: "excluir",
      ineditas: "excluir",
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
    };
    for (const chave of CHAVES_FILTRO) {
      const aplicado = alternarFiltro(FILTRO_PADRAO, chave, VALOR[chave]);
      expect(aplicado[chave]).not.toBe(FILTRO_PADRAO[chave]);
      expect(filtroEhPadrao(aplicado)).toBe(false);
      const desligado = semAChave(aplicado, chave);
      expect(desligado[chave]).toBe(FILTRO_PADRAO[chave]);
      expect(queryDeFiltros(desligado)).toBe("");
      const chip = chipsDeFiltro(aplicado).find((c) => c.chave === chave);
      expect(chip?.rotulo.length).toBeGreaterThan(0);
      // E o rótulo vem do domínio, não de um mapa solto no componente.
      expect(ROTULO_DAS_CHAVES[chave].length).toBeGreaterThan(0);
    }
    // Toda faceta contável tem de ser tag observável do item: se alguém pedir
    // select de `gabarito`, `bloco` ou `palavra` o tipo reclama, porque essas
    // três não são tag — são qualidade, aba e busca.
    expect(CHAVES_DE_CONTAGEM).toEqual([
      "disciplina",
      "assunto",
      "banca",
      "orgao",
      "cargo",
      "origem",
      "ano",
      "tipo",
    ]);
  });

  it("chipsDeFiltro nomeia o que está ativo e omite o padrão", () => {
    const filtros = lerFiltros({
      assunto: "Pontuação",
      palavra: "crase",
      orgao: "TRT - 15ª Região - SP",
      bloco: "fixacao",
      gabarito: "todos",
      anuladas: "excluir",
    });
    expect(chipsDeFiltro(filtros).map((c) => c.chave)).toEqual([
      "assunto",
      "palavra",
      "orgao",
      "bloco",
      "gabarito",
      "anuladas",
    ]);
    expect(chipsDeFiltro(filtros).find((c) => c.chave === "bloco")?.valor).toBe(
      "Exercícios de Fixação"
    );
    // O rótulo legível da procedência e da modalidade, nunca a chave interna.
    expect(chipsDeFiltro(lerFiltros({ origem: "aula-14" }))[0]).toMatchObject({
      rotulo: "Procedência",
      valor: "Aula 14",
    });
    expect(chipsDeFiltro(lerFiltros({ tipo: "certo_errado" }))[0]).toMatchObject({
      rotulo: "Modalidade",
      valor: "Certo/Errado",
    });
    expect(chipsDeFiltro(FILTRO_PADRAO)).toEqual([]);
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
    expect(aplicarFiltros(itens, FILTRO_PADRAO)).toHaveLength(2);
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

  it("o padrão da tela é gabarito confiável; `todos` é a única alternativa", () => {
    const itens = [
      itemEm(1),
      itemEm(2, { quarantined: true }),
      itemEm(3, { gabarito: null }),
    ];
    expect(aplicarFiltros(itens, lerFiltros({}))).toHaveLength(1);
    expect(aplicarFiltros(itens, lerFiltros({ gabarito: "confiavel" }))).toHaveLength(1);
    expect(aplicarFiltros(itens, lerFiltros({ gabarito: "todos" }))).toHaveLength(3);
    // Link antigo continua valendo: era filtro explícito, hoje é o padrão.
    expect(aplicarFiltros(itens, lerFiltros(new URLSearchParams("gabarito=confiavel")))).toHaveLength(
      1
    );
    // Combinado com outra tag, os predicados se acumulam (E), nunca se ignoram.
    expect(
      aplicarFiltros(itens, lerFiltros({ gabarito: "confiavel", assunto: "Ortografia" }))
    ).toHaveLength(1);
    expect(
      aplicarFiltros(itens, lerFiltros({ gabarito: "confiavel", assunto: "Pontuação" }))
    ).toHaveLength(0);
    // E a medição do acervo não é filtrada: a sanfona continua dizendo 3 distintas,
    // 2 sem gabarito confiável — senão a tela esconderia a própria pendência.
    expect(removerCopiasIdenticas(itens).semGabaritoConfiavel).toBe(2);
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
    expect(aplicarFiltros(removerCopiasIdenticas(dupla).itens, FILTRO_PADRAO)).toHaveLength(1);
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

describe("filtros da barra avançada", () => {
  it("palavra-chave procura no enunciado, no metadado e no código do lote", () => {
    const itens = [
      itemEm(1, { enunciado: "Assinale a alternativa com crase." }),
      itemEm(2, { enunciado: "Sobre a ortografia oficial do idioma…" }),
      itemEm(3, { banca: "TRT", orgao: null }),
    ];
    expect(aplicarFiltros(itens, lerFiltros({ palavra: "crase" }))).toHaveLength(1);
    // Sem acento e sem caixa: quem digita "ORTOGRAFIA OFICIAL" no celular não
    // pode receber lista vazia.
    expect(aplicarFiltros(itens, lerFiltros({ palavra: "ORTOGRAFIA OFICIAL" }))).toHaveLength(1);
    // Código do lote e metadado declarado também respondem à busca livre.
    expect(aplicarFiltros(itens, lerFiltros({ palavra: "A14-S01-003" }))).toHaveLength(1);
    expect(aplicarFiltros(itens, lerFiltros({ palavra: "TRT" }))).toHaveLength(1);
    expect(aplicarFiltros(itens, lerFiltros({ palavra: "nada assim no lote" }))).toHaveLength(0);
  });

  it("órgão e cargo filtram pelo que o material declarou, e nem todo item declara", () => {
    const itens = [
      itemEm(1, { orgao: "TRT - 15ª Região - SP", cargo: "Analista" }),
      itemEm(2, { orgao: "trt - 15ª região - sp", cargo: "TÉCNICO" }),
      itemEm(3, { orgao: null, cargo: null }),
    ];
    expect(aplicarFiltros(itens, lerFiltros({ orgao: "TRT - 15ª Região - SP" }))).toHaveLength(2);
    expect(aplicarFiltros(itens, lerFiltros({ cargo: "técnico" }))).toHaveLength(1);
    expect(aplicarFiltros(itens, lerFiltros({ orgao: "Inexistente" }))).toHaveLength(0);
    // A lacuna é medida para a barra dizer quantos não declaram, não para virar
    // opção falsa "Sem órgão" no select.
    expect(semFaceta(itens, "orgao")).toBe(1);
    expect(contagemDaFaceta(itens, "orgao")).toEqual([
      { valor: "TRT - 15ª Região - SP", total: 2 },
    ]);
  });

  it("aba de fixação é o bloco do material sem versão comentada, por cópia canônica", () => {
    const comentada = itemEm(1, { content_hash: "h1" });
    const mesmaNaLista = itemEm(2, {
      content_hash: "h1",
      secao_tipo: "lista",
      secao_rotulo: "Lista de Questões - Ortografia",
    });
    const soNaLista = itemEm(3, {
      content_hash: "h2",
      secao_tipo: "lista",
      secao_rotulo: "Lista de Questões - Compreensão textual",
      assunto: "Compreensão textual",
    });
    const acervo = removerCopiasIdenticas([comentada, mesmaNaLista, soNaLista]);

    // A questão publicada nos dois blocos não é exercício de fixação: sobra a
    // cópia comentada, e é ela que a aba mostra.
    expect(acervo.itens.filter(ehExercicioDeFixacao).map((i) => i.questao.id_local)).toEqual([
      "A14-S01-003",
    ]);
    expect(aplicarFiltros(acervo.itens, lerFiltros({ bloco: "objetivas" }))).toHaveLength(2);
    expect(aplicarFiltros(acervo.itens, lerFiltros({ bloco: "fixacao" }))).toHaveLength(1);
    // As abas não são partição: `objetivas` é o acervo inteiro e `fixacao` é um
    // recorte dele — por isso o total do padrão continua sendo o da tela (docs/31 §7.6).
    expect(totaisDasAbas(acervo.itens, FILTRO_PADRAO).map((a) => [a.valor, a.total])).toEqual([
      ["objetivas", 2],
      ["fixacao", 1],
    ]);
    expect(ABAS_CADERNO.map((a) => a.valor)).toEqual(["objetivas", "fixacao"]);
    // A aba tem de sobreviver ao round-trip da URL, senão o link compartilhado
    // abriria em "objetivas" o que o aluno viu em "fixação".
    const query = queryDeFiltros(lerFiltros({ bloco: "fixacao" }));
    expect(lerFiltros(new URLSearchParams(query)).bloco).toBe("fixacao");
  });

  it("excluir anuladas e inéditas usa o que o extrator registrou, nada de chute", () => {
    const itens = [
      itemEm(1),
      itemEm(2, { gabarito_metodo: "anulada", avisos: ["gabarito_anulado"] }),
      itemEm(3, {
        provenance_status: "inedita_compilador",
        proveniencia: {
          estado: "inedita_compilador",
          origem_gabarito: "compilador",
          doador_gabarito: null,
          classificacao_tag: null,
          tag_crua: null,
          paginas: [4, 4],
          secao: 1,
          grupo: 1,
          numero_original: 3,
          editado_por_humano: false,
        },
      }),
    ];
    // As três têm gabarito de uma letra, então passam no padrão de qualidade: o
    // que se tira aqui é refinamento, não o filtro de resposta.
    expect(aplicarFiltros(itens, FILTRO_PADRAO)).toHaveLength(3);
    expect(aplicarFiltros(itens, lerFiltros({ anuladas: "excluir" }))).toHaveLength(2);
    expect(aplicarFiltros(itens, lerFiltros({ ineditas: "excluir" }))).toHaveLength(2);
    expect(
      aplicarFiltros(itens, lerFiltros({ anuladas: "excluir", ineditas: "excluir" }))
    ).toHaveLength(1);
    expect(refinamentosDoContexto(itens, FILTRO_PADRAO)).toEqual({
      revisao: 0,
      anuladas: 1,
      ineditas: 1,
    });

    // Item sem resposta confirmada cai fora do padrão e volta com `todos` — e é
    // esse número que a barra mostra ao lado da caixa de incluir revisão.
    const comRevisao = [...itens, itemEm(4, { quarantined: true })];
    expect(aplicarFiltros(comRevisao, FILTRO_PADRAO)).toHaveLength(3);
    expect(aplicarFiltros(comRevisao, lerFiltros({ gabarito: "todos" }))).toHaveLength(4);
    expect(refinamentosDoContexto(comRevisao, FILTRO_PADRAO).revisao).toBe(1);
  });



  it("o total ao lado de cada opção é o que o clique devolve", () => {
    const itens = [
      itemEm(1, { assunto: "Pontuação", banca: "FGV" }),
      itemEm(2, { assunto: "Pontuação", banca: "VUNESP" }),
      itemEm(3, { assunto: "Ortografia", banca: "FGV" }),
      itemEm(4, { assunto: "Ortografia", banca: "FGV", quarantined: true }),
    ];
    // Sem filtro: o padrão já cortou a quarentena, então "Ortografia (1)" é a
    // verdade da tela — contar o acervo inteiro diria 2 e o aluno veria 1.
    expect(opcoesDoContexto(itens, FILTRO_PADRAO).assunto).toEqual([
      { valor: "Pontuação", total: 2 },
      { valor: "Ortografia", total: 1 },
    ]);
    expect(aplicarFiltros(itens, lerFiltros({ assunto: "Ortografia" }))).toHaveLength(1);

    // Com banca escolhida, a faceta de assunto é contada dentro daquela banca.
    const comBanca = opcoesDoContexto(itens, lerFiltros({ banca: "FGV" }));
    expect(comBanca.assunto).toEqual([
      { valor: "Ortografia", total: 1 },
      { valor: "Pontuação", total: 1 },
    ]);
    // E a própria banca é contada sem a restrição dela, senão sumiria do select
    // no instante em que o aluno a usasse.
    expect(comBanca.banca).toEqual([
      { valor: "FGV", total: 2 },
      { valor: "VUNESP", total: 1 },
    ]);
    // Ligando a revisão, as contagens sobem junto com a lista.
    expect(
      opcoesDoContexto(itens, lerFiltros({ gabarito: "todos" })).assunto.map((o) => o.total)
    ).toEqual([2, 2]);
    // A contagem é sempre feita sobre o acervo distinto: se alguém cortar a
    // página antes de contar, o select encolheria a cada clique.
    expect(Object.keys(opcoesDoContexto(itens, FILTRO_PADRAO)).sort()).toEqual(
      [...CHAVES_DE_CONTAGEM].sort()
    );
  });

  it("as chaves da barra são fechadas, rotuladas e têm caminho de volta", () => {
    // Ordem contratual de `CHAVES_FILTRO`: taxonomia, metadado de prova, depois
    // qualidade. Chip, URL compartilhada e teste de rota dependem dela.
    expect(CHAVES_FILTRO).toEqual([
      "disciplina",
      "assunto",
<<<<<<< HEAD
      "leis",
=======
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
      "palavra",
      "banca",
      "orgao",
      "cargo",
<<<<<<< HEAD
      "nivel",
      "dificuldade",
      "area_formacao",
      "area_atuacao",
      "origem",
      "ano",
      "tipo",
      "status_resolucao",
      "bloco",
      "gabarito",
      "desatualizadas",
      "anuladas",
      "ineditas",
      "meus_simulados",
      "meus_cadernos",
      "comentado",
      "comentarios",
      "meus_comentarios",
=======
      "origem",
      "ano",
      "tipo",
      "bloco",
      "gabarito",
      "anuladas",
      "ineditas",
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
    ]);
    const VALOR: Record<ChaveFiltro, string> = {
      disciplina: "Direito",
      assunto: "Pontuação",
<<<<<<< HEAD
      leis: "CF/88",
=======
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
      palavra: "crase",
      banca: "FGV",
      orgao: "TRT - 15ª Região - SP",
      cargo: "Soldado",
<<<<<<< HEAD
      nivel: "superior",
      dificuldade: "medio",
      area_formacao: "direito",
      area_atuacao: "policial",
      origem: "aula-14",
      ano: "2019",
      tipo: "certo_errado",
      status_resolucao: "resolvidas",
      bloco: "fixacao",
      gabarito: "todos",
      desatualizadas: "excluir",
      anuladas: "excluir",
      ineditas: "excluir",
      meus_simulados: "excluir",
      meus_cadernos: "excluir",
      comentado: "sim",
      comentarios: "sim",
      meus_comentarios: "sim",
=======
      origem: "aula-14",
      ano: "2019",
      tipo: "certo_errado",
      bloco: "fixacao",
      gabarito: "todos",
      anuladas: "excluir",
      ineditas: "excluir",
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
    };
    // Cobertura por chave: filtro novo sem casa em `alternarFiltro` ou sem rótulo
    // viraria botão morto na barra e chip sem nome.
    for (const chave of CHAVES_FILTRO) {
      const aplicado = alternarFiltro(FILTRO_PADRAO, chave, VALOR[chave]);
      expect(aplicado[chave]).not.toBe(FILTRO_PADRAO[chave]);
      expect(filtroEhPadrao(aplicado)).toBe(false);
      const desligado = semAChave(aplicado, chave);
      expect(desligado[chave]).toBe(FILTRO_PADRAO[chave]);
      expect(queryDeFiltros(desligado)).toBe("");
      expect(chipsDeFiltro(aplicado).find((c) => c.chave === chave)?.rotulo.length).toBeGreaterThan(
        0
      );
    }
  });

  it("o rodapé nomeia o que não pode ser filtrado, com a fonte da trava", () => {
    // Filtros do desenho de referência que este acervo não pode responder. A
    // barra lista nome, motivo e fonte em vez de renderizar caixa muda: caixa que
    // não filtra nada parece produto pronto e é lacuna de dado.
    expect(FILTROS_TRAVADOS.map((f) => f.rotulo)).toEqual([
      "Nível",
      "Dificuldade",
      "Área de Formação",
      "Área de Atuação",
      "Gabarito Comentado",
      "Comentários da comunidade",
      "Meus Comentários",
      "Minhas Anotações",
      "Aulas",
      "Dos meus cadernos",
      "Dos meus simulados",
      "Desatualizadas",
      "Salvar Filtros",
    ]);
    for (const travado of FILTROS_TRAVADOS) {
      expect(travado.motivo.length).toBeGreaterThan(10);
      // Toda trava aponta um arquivo — a regra da casa (nunca descrever um filtro
      // sem dizer qual arquivo o define), aplicada ao avesso.
      expect(travado.fonte).toMatch(/\.(ts|tsx|py)\b/);
    }
    // O que o lote declara vira chave, e é isso que a barra oferece.
    for (const chave of ["palavra", "orgao", "cargo", "bloco", "anuladas", "ineditas"] as const) {
      expect(CHAVES_FILTRO).toContain(chave);
    }
  });

  it("anuladas e inéditas aparecem por medição, não por gosto", () => {
    // No lote de hoje as anuladas estão todas sem gabarito confiável: enquanto o
    // padrão de qualidade estiver ligado não há nada para excluir, e a caixa não
    // surge. É o contrato de `refinamentosDoContexto`, não esconderijo.
    const anuladaEmQuarentena = itemEm(1, {
      gabarito_metodo: "anulada",
      avisos: ["gabarito_anulado"],
      quarantined: true,
    });
    expect(refinamentosDoContexto([anuladaEmQuarentena], FILTRO_PADRAO)).toEqual({
      revisao: 1,
      anuladas: 0,
      ineditas: 0,
    });
    expect(
      refinamentosDoContexto([anuladaEmQuarentena], lerFiltros({ gabarito: "todos" })).anuladas
    ).toBe(1);
    // Inéditas: zero hoje, e o predicado já existe para o dia de uma apostila nova.
    expect(refinamentosDoContexto([itemEm(2)], FILTRO_PADRAO).ineditas).toBe(0);
  });

  it("aba, chip e paginação montam a mesma query, sempre na mesma ordem", () => {
    const filtros = lerFiltros({ assunto: "Pontuação", gabarito: "todos", bloco: "fixacao" });
    expect(queryDeFiltros(filtros)).toBe(
      "assunto=Pontua%C3%A7%C3%A3o&bloco=fixacao&gabarito=todos"
    );
    expect(queryDePagina(filtros, calcularPagina({}, 100))).toBe(queryDeFiltros(filtros));
    expect(queryDePagina(filtros, calcularPagina({ page: "2" }, 100))).toContain("page=2");
    expect(lerFiltros(new URLSearchParams(queryDeFiltros(filtros)))).toEqual(filtros);
  });
});

