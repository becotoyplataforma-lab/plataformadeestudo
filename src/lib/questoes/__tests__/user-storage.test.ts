import { describe, it, expect, beforeEach, beforeAll } from "vitest";

// Mock de localStorage e window para ambiente Node do Vitest
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, String(v)),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
};

beforeAll(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: mockLocalStorage,
    writable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: {
      ...globalThis,
      dispatchEvent: () => true,
    },
    writable: true,
  });
});

import {
  alternarQuestaoNoCaderno,
  criarCadernoPersonalizado,
  excluirCadernoPersonalizado,
  limparCadernoDeErros,
  obterCadernosPersonalizados,
  obterFlashcardsLocais,
  obterHistoricoSimulados,
  obterIdsAcertados,
  obterIdsComErro,
  obterIdsResolvidos,
  obterTentativa,
  questaoEstaEmQuaisCadernos,
  questaoTemFlashcard,
  registrarHistoricoSimulado,
  registrarTentativaLocal,
  salvarFlashcardLocal,
  salvarHistoricoSimulado,
  calcularRaioXDesempenho,
} from "../user-storage";
import { PRESETS_SIMULADOS } from "../../simulados/tipos";

describe("user-storage: Caderno de Erros & Tentativas", () => {
  beforeEach(() => {
    store.clear();
  });

  it("registra tentativa e atualiza caderno de erros e acertos", () => {
    expect(obterIdsComErro()).toEqual([]);
    expect(obterIdsAcertados()).toEqual([]);

    // Aluno erra a questão 1
    registrarTentativaLocal("q-001", "A", false);
    expect(obterIdsComErro()).toContain("q-001");
    expect(obterIdsAcertados()).not.toContain("q-001");
    expect(obterTentativa("q-001")?.letraSelecionada).toBe("A");

    // Aluno acerta a questão 2
    registrarTentativaLocal("q-002", "C", true);
    expect(obterIdsAcertados()).toContain("q-002");
    expect(obterIdsResolvidos()).toHaveLength(2);

    // Aluno refaz a questão 1 e agora acerta: sai dos erros e vai para os acertos!
    registrarTentativaLocal("q-001", "B", true);
    expect(obterIdsComErro()).not.toContain("q-001");
    expect(obterIdsAcertados()).toContain("q-001");
  });

  it("limpa caderno de erros mantendo os acertos", () => {
    registrarTentativaLocal("q-010", "D", false);
    registrarTentativaLocal("q-020", "B", true);

    expect(obterIdsComErro()).toHaveLength(1);
    expect(obterIdsAcertados()).toHaveLength(1);

    limparCadernoDeErros();

    expect(obterIdsComErro()).toHaveLength(0);
    expect(obterIdsAcertados()).toHaveLength(1);
  });
});

describe("user-storage: Cadernos Personalizados", () => {
  beforeEach(() => {
    store.clear();
  });

  it("retorna cadernos padrão quando vazio", () => {
    const cadernos = obterCadernosPersonalizados();
    expect(cadernos.length).toBeGreaterThanOrEqual(3);
    expect(cadernos.some((c) => c.id === "favoritas")).toBe(true);
  });

  it("permite criar, adicionar e alternar questões em cadernos", () => {
    const novo = criarCadernoPersonalizado("Pegadinhas FGV", "#f59e0b", "Cuidado com o exceto");
    expect(novo.nome).toBe("Pegadinhas FGV");

    // Alterna inserção
    const adicionou = alternarQuestaoNoCaderno(novo.id, "q-100");
    expect(adicionou).toBe(true);
    expect(questaoEstaEmQuaisCadernos("q-100")).toContain(novo.id);

    // Alterna remoção
    const removeu = alternarQuestaoNoCaderno(novo.id, "q-100");
    expect(removeu).toBe(false);
    expect(questaoEstaEmQuaisCadernos("q-100")).not.toContain(novo.id);
  });

  it("permite excluir caderno personalizado", () => {
    const novo = criarCadernoPersonalizado("Temporário", "#10b981");
    expect(obterCadernosPersonalizados().some((c) => c.id === novo.id)).toBe(true);

    excluirCadernoPersonalizado(novo.id);
    expect(obterCadernosPersonalizados().some((c) => c.id === novo.id)).toBe(false);
  });
});

describe("user-storage & tipos: Simulados", () => {
  beforeEach(() => {
    store.clear();
  });

  it("presets de simulados são consistentes", () => {
    expect(PRESETS_SIMULADOS.length).toBe(3);
    const express = PRESETS_SIMULADOS.find((p) => p.id === "cbmrj-express");
    expect(express?.totalQuestoes).toBe(10);
    expect(express?.duracaoMinutos).toBe(20);

    const padrao = PRESETS_SIMULADOS.find((p) => p.id === "cbmrj-padrao");
    expect(padrao?.totalQuestoes).toBe(30);
    expect(padrao?.duracaoMinutos).toBe(60);
  });

  it("registra e recupera histórico de simulados", () => {
    expect(obterHistoricoSimulados()).toEqual([]);

    salvarHistoricoSimulado({
      titulo: "Simulado Express CBM-RJ",
      totalQuestoes: 10,
      acertos: 8,
      tempoGastoSegundos: 720,
      dataIso: new Date().toISOString(),
      resumoPorMateria: {
        "Língua Portuguesa": { total: 5, acertos: 4 },
        "Matemática": { total: 5, acertos: 4 },
      },
    });

    const historico = obterHistoricoSimulados();
    expect(historico).toHaveLength(1);
    expect(historico[0]?.acertos).toBe(8);
    expect(historico[0]?.totalQuestoes).toBe(10);
  });
});

describe("user-storage: Flashcards de Erros (1 Clique)", () => {
  beforeEach(() => {
    store.clear();
  });

  it("salva e recupera flashcard gerado a partir de erro", () => {
    expect(obterFlashcardsLocais()).toEqual([]);
    expect(questaoTemFlashcard("q-001")).toBe(false);

    salvarFlashcardLocal({
      questaoId: "q-001",
      frente: "Como aplicar crase antes de pronome relativo?",
      verso: "Somente ocorre crase antes de 'a qual / as quais'.",
      disciplina: "Língua Portuguesa",
      assunto: "Crase",
    });

    const flashcards = obterFlashcardsLocais();
    expect(flashcards).toHaveLength(1);
    expect(flashcards[0]?.frente).toContain("crase");
    expect(questaoTemFlashcard("q-001")).toBe(true);
    expect(questaoTemFlashcard("q-999")).toBe(false);
  });
});

describe("user-storage: Raio-X de Desempenho", () => {
  beforeEach(() => {
    store.clear();
  });

  it("calcula pontos fortes, em evolução e vulnerabilidades", () => {
    // Aluno acerta 9 de 10 em Ortografia (90% -> Forte)
    for (let i = 1; i <= 9; i++) registrarTentativaLocal(`q-ort-${i}`, "A", true);
    registrarTentativaLocal("q-ort-10", "B", false);

    // Aluno acerta 6 de 10 em Sintaxe (60% -> Em evolução)
    for (let i = 1; i <= 6; i++) registrarTentativaLocal(`q-sin-${i}`, "C", true);
    for (let i = 7; i <= 10; i++) registrarTentativaLocal(`q-sin-${i}`, "A", false);

    // Aluno acerta 2 de 10 em Geometria Espacial (20% -> Vulnerabilidade Crítica)
    for (let i = 1; i <= 2; i++) registrarTentativaLocal(`q-geo-${i}`, "D", true);
    for (let i = 3; i <= 10; i++) registrarTentativaLocal(`q-geo-${i}`, "B", false);

    const metadados: Record<string, { disciplina: string; assunto: string }> = {};
    for (let i = 1; i <= 10; i++) {
      metadados[`q-ort-${i}`] = { disciplina: "Língua Portuguesa", assunto: "Ortografia" };
      metadados[`q-sin-${i}`] = { disciplina: "Língua Portuguesa", assunto: "Sintaxe" };
      metadados[`q-geo-${i}`] = { disciplina: "Matemática", assunto: "Geometria Espacial" };
    }

    const diag = calcularRaioXDesempenho(metadados);
    expect(diag.totalQuestoes).toBe(30);
    expect(diag.totalAcertos).toBe(17);

    // Pontos fortes
    expect(diag.pontosFortes.some((t) => t.topico === "Ortografia" && t.taxa === 90)).toBe(true);

    // Em evolução
    expect(diag.emEvolucao.some((t) => t.topico === "Sintaxe" && t.taxa === 60)).toBe(true);

    // Vulnerabilidades
    expect(diag.vulnerabilidades.some((t) => t.topico === "Geometria Espacial" && t.taxa === 20)).toBe(true);

    // Foco recomendado deve ser o tópico mais vulnerável
    expect(diag.focoRecomendado?.topico).toBe("Geometria Espacial");
  });
});
