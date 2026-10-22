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

// ============================================================
// 4. FLASHCARDS GERADOS A PARTIR DE ERROS (1 CLIQUE)
// ============================================================

export interface FlashcardLocal {
  id: string;
  questaoId: string;
  frente: string;
  verso: string;
  disciplina?: string;
  assunto?: string;
  criadoEm: number;
}

const CHAVE_FLASHCARDS = "concursoai_flashcards_locais_v1";

export function obterFlashcardsLocais(): FlashcardLocal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAVE_FLASHCARDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function salvarFlashcardLocal(
  flashcard: Omit<FlashcardLocal, "id" | "criadoEm">
): FlashcardLocal {
  const lista = obterFlashcardsLocais();
  const novo: FlashcardLocal = {
    ...flashcard,
    id: "fc-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
    criadoEm: Date.now(),
  };
  lista.unshift(novo);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CHAVE_FLASHCARDS, JSON.stringify(lista));
      window.dispatchEvent(new Event("concursoai_flashcards_atualizado"));
    } catch (err) {
      console.error("[user-storage] Erro ao salvar flashcard:", err);
    }
  }
  return novo;
}

export function questaoTemFlashcard(questaoId: string): boolean {
  const lista = obterFlashcardsLocais();
  return lista.some((f) => f.questaoId === questaoId);
}

// ============================================================
// 5. RAIO-X DE DESEMPENHO POR TÓPICO
// ============================================================

export interface TopicoRaioX {
  disciplina: string;
  topico: string;
  total: number;
  acertos: number;
  erros: number;
  taxa: number; // 0..100
  status: "forte" | "evolucao" | "critico";
}

export interface DiagnosticoRaioX {
  totalQuestoes: number;
  totalAcertos: number;
  taxaGeral: number;
  pontosFortes: TopicoRaioX[];
  emEvolucao: TopicoRaioX[];
  vulnerabilidades: TopicoRaioX[];
  focoRecomendado: TopicoRaioX | null;
}

export function calcularRaioXDesempenho(
  metadadosQuestoes?: Record<string, { disciplina?: string; assunto?: string }>
): DiagnosticoRaioX {
  const tentativas = obterTodasTentativas();
  const listaTentativas = Object.values(tentativas);

  if (listaTentativas.length === 0) {
    return {
      totalQuestoes: 0,
      totalAcertos: 0,
      taxaGeral: 0,
      pontosFortes: [],
      emEvolucao: [],
      vulnerabilidades: [],
      focoRecomendado: null,
    };
  }

  const mapaTopicos: Record<
    string,
    { disciplina: string; topico: string; total: number; acertos: number; erros: number }
  > = {};

  let totalGeral = 0;
  let acertosGeral = 0;

  for (const t of listaTentativas) {
    totalGeral++;
    if (t.acertou) acertosGeral++;

    const meta = metadadosQuestoes?.[t.questaoId];
    const disciplina = meta?.disciplina || (t.questaoId.includes("mat") ? "Matemática" : "Língua Portuguesa");
    const topico = meta?.assunto || "Geral e Fundamentos";
    const chave = `${disciplina}:::${topico}`;

    if (!mapaTopicos[chave]) {
      mapaTopicos[chave] = { disciplina, topico, total: 0, acertos: 0, erros: 0 };
    }
    mapaTopicos[chave].total++;
    if (t.acertou) {
      mapaTopicos[chave].acertos++;
    } else {
      mapaTopicos[chave].erros++;
    }
  }

  const taxaGeral = totalGeral > 0 ? Math.round((acertosGeral / totalGeral) * 100) : 0;

  const todosTopicos: TopicoRaioX[] = Object.values(mapaTopicos).map((item) => {
    const taxa = item.total > 0 ? Math.round((item.acertos / item.total) * 100) : 0;
    const status: "forte" | "evolucao" | "critico" =
      taxa >= 75 ? "forte" : taxa >= 50 ? "evolucao" : "critico";
    return {
      ...item,
      taxa,
      status,
    };
  });

  const pontosFortes = todosTopicos
    .filter((t) => t.status === "forte")
    .sort((a, b) => b.taxa - a.taxa || b.total - a.total);

  const emEvolucao = todosTopicos
    .filter((t) => t.status === "evolucao")
    .sort((a, b) => a.taxa - b.taxa);

  const vulnerabilidades = todosTopicos
    .filter((t) => t.status === "critico")
    .sort((a, b) => a.taxa - b.taxa || b.erros - a.erros);

  // Foco recomendado: a vulnerabilidade com maior número de erros ou menor taxa
  const focoRecomendado = vulnerabilidades[0] ?? emEvolucao[0] ?? null;

  return {
    totalQuestoes: totalGeral,
    totalAcertos: acertosGeral,
    taxaGeral,
    pontosFortes,
    emEvolucao,
    vulnerabilidades,
    focoRecomendado,
  };
}

