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
  obterHistoricoSimulados,
  obterIdsAcertados,
  obterIdsComErro,
  obterIdsResolvidos,
  obterTentativa,
  questaoEstaEmQuaisCadernos,
  registrarHistoricoSimulado,
  registrarTentativaLocal,
  salvarHistoricoSimulado,
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
