"use client";

/**
 * ConcursoAI — Armazenamento e gerenciamento do progresso do aluno (Offline-first / LocalStorage)
 *
 * Gerencia:
 * 1. Tentativas e Caderno de Erros (questões resolvidas, acertadas e erradas).
 * 2. Cadernos Personalizados criados pelo aluno (ex: "Fórmulas de Geometria", "Pegadinhas FGV").
 * 3. Histórico de Simulados realizados com notas e estatísticas.
 */

export interface TentativaLocal {
  questaoId: string;
  letraSelecionada: string;
  acertou: boolean;
  tempoSegundos?: number;
  timestamp: number;
}

export interface CadernoPersonalizado {
  id: string;
  nome: string;
  cor: string;
  descricao?: string;
  questoesIds: string[];
  criadoEm: number;
  atualizadoEm: number;
}

export interface HistoricoSimulado {
  id: string;
  titulo: string;
  totalQuestoes: number;
  acertos: number;
  tempoGastoSegundos: number;
  dataIso: string;
  resumoPorMateria: Record<string, { total: number; acertos: number }>;
}

const CHAVE_TENTATIVAS = "concursoai_tentativas_v1";
const CHAVE_CADERNOS = "concursoai_cadernos_personalizados_v1";
const CHAVE_SIMULADOS = "concursoai_simulados_historico_v1";

const CADERNOS_PADRAO: CadernoPersonalizado[] = [
  {
    id: "favoritas",
    nome: "Questões Favoritas",
    cor: "#06b6d4", // Cyan
    descricao: "Questões marcadas como destaque para revisar com frequência.",
    questoesIds: [],
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  },
  {
    id: "pegadinhas",
    nome: "Pegadinhas da Banca",
    cor: "#f59e0b", // Amber
    descricao: "Questões com enunciados capciosos ou pegadinhas clássicas da FGV.",
    questoesIds: [],
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  },
  {
    id: "regras-formulas",
    nome: "Regras e Fórmulas",
    cor: "#8b5cf6", // Purple
    descricao: "Questões que exigem memorização de fórmulas matemáticas ou regras gramaticais.",
    questoesIds: [],
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  },
];

// ============================================================
// 1. TENTATIVAS E CADERNO DE ERROS
// ============================================================

export function obterTodasTentativas(): Record<string, TentativaLocal> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CHAVE_TENTATIVAS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function registrarTentativaLocal(
  questaoId: string,
  letraSelecionada: string,
  acertou: boolean,
  tempoSegundos = 0
): void {
  if (typeof window === "undefined") return;
  try {
    const mapa = obterTodasTentativas();
    mapa[questaoId] = {
      questaoId,
      letraSelecionada,
      acertou,
      tempoSegundos,
      timestamp: Date.now(),
    };
    localStorage.setItem(CHAVE_TENTATIVAS, JSON.stringify(mapa));
    // Dispara evento para atualização reativa em componentes ouvintes
    window.dispatchEvent(new Event("concursoai_progresso_atualizado"));
  } catch (err) {
    console.error("[user-storage] Erro ao gravar tentativa:", err);
  }
}

export function obterTentativa(questaoId: string): TentativaLocal | null {
  const mapa = obterTodasTentativas();
  return mapa[questaoId] ?? null;
}

export function obterIdsComErro(): string[] {
  const mapa = obterTodasTentativas();
  return Object.values(mapa)
    .filter((t) => !t.acertou)
    .map((t) => t.questaoId);
}

export function obterIdsAcertados(): string[] {
  const mapa = obterTodasTentativas();
  return Object.values(mapa)
    .filter((t) => t.acertou)
    .map((t) => t.questaoId);
}

export function obterIdsResolvidos(): string[] {
  const mapa = obterTodasTentativas();
  return Object.keys(mapa);
}

export function limparCadernoDeErros(): void {
  if (typeof window === "undefined") return;
  try {
    const mapa = obterTodasTentativas();
    // Mantém apenas os acertos
    const novoMapa: Record<string, TentativaLocal> = {};
    for (const [id, t] of Object.entries(mapa)) {
      if (t.acertou) novoMapa[id] = t;
    }
    localStorage.setItem(CHAVE_TENTATIVAS, JSON.stringify(novoMapa));
    window.dispatchEvent(new Event("concursoai_progresso_atualizado"));
  } catch (err) {
    console.error("[user-storage] Erro ao limpar erros:", err);
  }
}

// ============================================================
// 2. CADERNOS PERSONALIZADOS
// ============================================================

export function obterCadernosPersonalizados(): CadernoPersonalizado[] {
  if (typeof window === "undefined") return CADERNOS_PADRAO;
  try {
    const raw = localStorage.getItem(CHAVE_CADERNOS);
    if (!raw) {
      localStorage.setItem(CHAVE_CADERNOS, JSON.stringify(CADERNOS_PADRAO));
      return CADERNOS_PADRAO;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : CADERNOS_PADRAO;
  } catch {
    return CADERNOS_PADRAO;
  }
}

export function salvarCadernosPersonalizados(cadernos: CadernoPersonalizado[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAVE_CADERNOS, JSON.stringify(cadernos));
    window.dispatchEvent(new Event("concursoai_cadernos_atualizado"));
  } catch (err) {
    console.error("[user-storage] Erro ao salvar cadernos:", err);
  }
}

export function criarCadernoPersonalizado(
  nome: string,
  cor = "#06b6d4",
  descricao = ""
): CadernoPersonalizado {
  const cadernos = obterCadernosPersonalizados();
  const id = "caderno-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  const novo: CadernoPersonalizado = {
    id,
    nome: nome.trim(),
    cor,
    descricao: descricao.trim() || undefined,
    questoesIds: [],
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  };
  cadernos.push(novo);
  salvarCadernosPersonalizados(cadernos);
  return novo;
}

export function excluirCadernoPersonalizado(id: string): void {
  const cadernos = obterCadernosPersonalizados().filter((c) => c.id !== id);
  salvarCadernosPersonalizados(cadernos);
}

export const removerCadernoPersonalizado = excluirCadernoPersonalizado;

export function alternarQuestaoNoCaderno(cadernoId: string, questaoId: string): boolean {
  const cadernos = obterCadernosPersonalizados();
  const caderno = cadernos.find((c) => c.id === cadernoId);
  if (!caderno) return false;

  const jaTem = caderno.questoesIds.includes(questaoId);
  if (jaTem) {
    caderno.questoesIds = caderno.questoesIds.filter((id) => id !== questaoId);
  } else {
    caderno.questoesIds.push(questaoId);
  }
  caderno.atualizadoEm = Date.now();
  salvarCadernosPersonalizados(cadernos);
  return !jaTem; // Devolve se agora está no caderno
}

export function questaoEstaEmQuaisCadernos(questaoId: string): string[] {
  const cadernos = obterCadernosPersonalizados();
  return cadernos.filter((c) => c.questoesIds.includes(questaoId)).map((c) => c.id);
}

// ============================================================
// 3. HISTÓRICO DE SIMULADOS
// ============================================================

export function obterHistoricoSimulados(): HistoricoSimulado[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAVE_SIMULADOS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function registrarHistoricoSimulado(
  simulado: Omit<HistoricoSimulado, "id"> | HistoricoSimulado
): HistoricoSimulado {
  const historico = obterHistoricoSimulados();
  const novo: HistoricoSimulado = {
    ...simulado,
    id: ("id" in simulado && simulado.id) || "sim-" + Date.now().toString(36),
  };
  historico.unshift(novo);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CHAVE_SIMULADOS, JSON.stringify(historico));
      window.dispatchEvent(new Event("concursoai_simulados_atualizado"));
    } catch (err) {
      console.error("[user-storage] Erro ao salvar histórico de simulado:", err);
    }
  }
  return novo;
}

export const salvarHistoricoSimulado = registrarHistoricoSimulado;
