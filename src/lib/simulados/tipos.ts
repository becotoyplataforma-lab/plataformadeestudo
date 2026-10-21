/**
 * ConcursoAI — Definições de Tipos para o Módulo de Simulados
 */

export interface AlternativaSimulado {
  letra: string;
  texto: string;
}

export interface QuestaoSimulado {
  id: string;
  codigo?: string;
  disciplina: string;
  assunto?: string;
  banca?: string | null;
  ano?: number | null;
  orgao?: string | null;
  enunciado: string;
  alternativas: AlternativaSimulado[];
  gabarito: string;
  tipo?: "multipla_escolha" | "certo_errado";
}

export interface PresetSimulado {
  id: string;
  titulo: string;
  subtitulo: string;
  duracaoMinutos: number;
  totalQuestoes: number;
  distribuicao: { disciplina: string; quantidade: number }[];
  badge: string;
  cor: string;
  destaque?: boolean;
}

export interface RespostaAlunoSimulado {
  questaoId: string;
  letraMarcada: string | null;
  marcadaParaRevisar: boolean;
  tempoGastoSegundos: number;
}

export interface DesempenhoMateria {
  total: number;
  acertos: number;
  erros: number;
  emBranco: number;
  porcentagem: number;
}

export interface RelatorioSimulado {
  id: string;
  titulo: string;
  totalQuestoes: number;
  respondidas: number;
  acertos: number;
  erros: number;
  emBranco: number;
  porcentagemAcerto: number;
  tempoGastoSegundos: number;
  tempoLimiteSegundos: number;
  aprovado: boolean;
  porMateria: Record<string, DesempenhoMateria>;
  questoesErradasIds: string[];
  dataIso: string;
}

export const PRESETS_SIMULADOS: PresetSimulado[] = [
  {
    id: "cbmrj-express",
    titulo: "Simulado Express CBM-RJ",
    subtitulo: "10 questões balanceadas para um treino rápido e focado durante intervalos do dia.",
    duracaoMinutos: 20,
    totalQuestoes: 10,
    distribuicao: [
      { disciplina: "Língua Portuguesa", quantidade: 5 },
      { disciplina: "Matemática", quantidade: 5 },
    ],
    badge: "⚡ 20 min · 10 Questões",
    cor: "#06b6d4", // Cyan
  },
  {
    id: "cbmrj-padrao",
    titulo: "Simulado Oficial CBM-RJ",
    subtitulo: "30 questões no formato exato da prova: 15 de Português e 15 de Matemática banca FGV.",
    duracaoMinutos: 60,
    totalQuestoes: 30,
    distribuicao: [
      { disciplina: "Língua Portuguesa", quantidade: 15 },
      { disciplina: "Matemática", quantidade: 15 },
    ],
    badge: "🚒 Oficial · 60 min · 30 Questões",
    cor: "#3b82f6", // Blue
    destaque: true,
  },
  {
    id: "maratona-fgv",
    titulo: "Maratona FGV Prova Completa",
    subtitulo: "50 questões com teste de resistência mental e gestão rigorosa de tempo sob pressão.",
    duracaoMinutos: 150,
    totalQuestoes: 50,
    distribuicao: [
      { disciplina: "Língua Portuguesa", quantidade: 25 },
      { disciplina: "Matemática", quantidade: 25 },
    ],
    badge: "🏆 2h30 · 50 Questões",
    cor: "#8b5cf6", // Purple
  },
];
