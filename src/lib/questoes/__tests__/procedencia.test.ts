/**
 * Testes da camada de leitura do dataset extraído (procedência + rotas).
 *
 * Cobrimos aqui o que a UI expõe sem cálculo: a ordem e a ausência dos selos
 * de metadados, a confiabilidade do gabarito e o formato de id que a rota usa
 * para responder 404. É teste de função pura em ambiente node — o card em si é
 * validado no E2E (`tests/e2e/aula-14-smoke.spec.ts`).
 */
import { describe, it, expect } from "vitest";
import {
  LABEL_GABARITO,
  alternativasOrdenadas,
  gabaritoConfiavel,
  rotuloGabarito,
  selosMetadados,
  trilhaMetadados,
  type QuestaoExtraida,
} from "../procedencia";
import { decomporIdLocal, ehIdLocalValido, ehUuid, rotasQuestoes } from "../rotas";

function questaoBase(
  sob: Partial<QuestaoExtraida> = {}
): QuestaoExtraida {
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
    enunciado: "A grafia está correta.",
    alternativas: { C: "Certo", E: "Errado" },
    gabarito: "E",
    gabarito_original: "E",
    gabarito_metodo: "bloco_gabarito",
    origem_gabarito: "gabarito_oficial",
    doador_gabarito: null,
    pagina_pdf: 12,
    page_refs: [12],
    content_hash: "0123456789abcdef0123456789abcdef",
    body_hash: "fedcba9876543210fedcba9876543210",
    duplicata_de: null,
    proveniencia: {
      estado: "oficial_prova",
      origem_gabarito: "gabarito_oficial",
      doador_gabarito: null,
      classificacao_tag: "Ortografia",
      tag_crua: null,
      paginas: [12],
      secao: 1,
      grupo: 1,
      numero_original: 1,
      editado_por_humano: false,
    },
    provenance_status: "oficial_prova",
    quarantined: false,
    status: "em_revisao",
    origin: "pdf_aula_14",
    resolucao_status: "pendente_geracao",
    isPublic: false,
    explicacao: null,
    links: { teoria: null, questao: null, fonte_pdf: null },
    avisos: [],
    ...sob,
  };
}

describe("selosMetadados (trilha Banca·Ano ▸ Disciplina ▸ Assunto ▸ Órgão)", () => {
  it("emite os selos na ordem do padrão de leitura", () => {
    const selos = selosMetadados(
      questaoBase({ orgao: "Prefeitura de Pouso Alegre - MG" })
    );
    expect(selos.map((s) => s.chave)).toEqual([
      "banca_ano",
      "disciplina",
      "assunto",
      "orgao",
    ]);
    expect(selos[0].texto).toBe("INOVERSASUL · 2025");
    expect(trilhaMetadados(questaoBase({ orgao: "MARINHA" })).join(" ▸ ")).toBe(
      "INOVERSASUL · 2025 ▸ Língua Portuguesa ▸ Ortografia ▸ MARINHA"
    );
  });

  it("sem banca mas com ano declarado mostra só o ano (não inventa banca)", () => {
    const selos = selosMetadados(questaoBase({ banca: null, orgao: "MARINHA" }));
    expect(selos.map((s) => s.texto)).toEqual([
      "2025",
      "Língua Portuguesa",
      "Ortografia",
      "MARINHA",
    ]);
  });

  it("omite o selo quando nem banca nem ano existem", () => {
    const selos = selosMetadados(questaoBase({ banca: null, ano: null }));
    expect(selos.map((s) => s.chave)).toEqual(["disciplina", "assunto"]);
  });

  it("não imprime selo de assunto vazio", () => {
    const selos = selosMetadados(questaoBase({ assunto: "" }));
    expect(selos.some((s) => s.chave === "assunto")).toBe(false);
  });
});

describe("alternativasOrdenadas", () => {
  it("ordena por letra, inclusive quando o JSON vem fora de ordem", () => {
    const q = questaoBase({
      tipo: "multipla_escolha",
      alternativas: { D: "quatro", A: "um", C: "três", B: "dois" },
    });
    expect(alternativasOrdenadas(q).map((a) => a.letra)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  it("mantém C/E na ordem certa para item certo/errado", () => {
    const q = questaoBase({ alternativas: { E: "Errado", C: "Certo" } });
    expect(alternativasOrdenadas(q)).toEqual([
      { letra: "C", texto: "Certo" },
      { letra: "E", texto: "Errado" },
    ]);
  });
});

describe("gabaritoConfiavel / rotuloGabarito", () => {
  it("item em quarentena nunca é tratado como confiável", () => {
    expect(gabaritoConfiavel(questaoBase({ quarantined: true }))).toBe(false);
    expect(rotuloGabarito(questaoBase({ quarantined: true }))).toBeNull();
  });

  it("gabarito ausente não vira palpite", () => {
    expect(gabaritoConfiavel(questaoBase({ gabarito: null }))).toBe(false);
  });

  it("letra C/E ganha rótulo legível, múltipla escolha mantém a letra", () => {
    expect(rotuloGabarito(questaoBase())).toBe(LABEL_GABARITO.E);
    expect(
      rotuloGabarito(questaoBase({ tipo: "multipla_escolha", gabarito: "B" }))
    ).toBe("B");
  });
});

describe("rotas e ids do caderno", () => {
  it("a rota do caderno é a matéria, não o PDF", () => {
    expect(rotasQuestoes.caderno("portugues")).toBe("/questoes/portugues");
    expect(rotasQuestoes.questao("A14-S01-001")).toBe("/questoes/A14-S01-001");
  });

  it("nenhuma rota gerada carrega número de aula no path", () => {
    for (const rota of [
      rotasQuestoes.raiz,
      rotasQuestoes.caderno("portugues"),
      rotasQuestoes.questao("A14-S01-001"),
      rotasQuestoes.cadernoComFiltros("portugues", "origem=aula-14"),
    ]) {
      expect(rota.split("?")[0]).not.toMatch(/aula-\d+/);
      expect(rota.split("?")[0]).not.toMatch(/cbm-/);
    }
  });

  it("id no formato A14-Sxx-nnn é aceito; o resto é 404", () => {
    expect(ehIdLocalValido("A14-S05-033")).toBe(true);
    for (const id of ["A14-S5-33", "A1-S05-033", "A14-S05-0033", "../x", ""]) {
      expect(ehIdLocalValido(id)).toBe(false);
    }
  });

  it("uuid é distinguishido de código de lote", () => {
    expect(ehUuid("8f14e45f-eea6-4c5b-8b7d-2f6b1a2c3d4e")).toBe(true);
    expect(ehUuid("A14-S01-001")).toBe(false);
  });

  it("decomporIdLocal lê aula (procedência), seção e número", () => {
    expect(decomporIdLocal("A14-S22-007")).toEqual({
      aula: 14,
      secao: 22,
      numero: 7,
    });
    expect(decomporIdLocal("A14-S22-7")).toBeNull();
  });
});
