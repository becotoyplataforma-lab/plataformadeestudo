"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  Flame,
  HelpCircle,
  Layers,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  calcularRaioXDesempenho,
  type DiagnosticoRaioX,
  type TopicoRaioX,
} from "@/lib/questoes/user-storage";
import { cn } from "@/lib/utils";

export interface RaioXDesempenhoProps {
  initialWeakness?: Array<{
    subjectName: string;
    accuracy: number;
    total: number;
    correct: number;
    topics?: Array<{ topic: string; accuracy: number; total: number; correct: number }>;
  }>;
}

// Tópicos de referência para o CBM-RJ quando o aluno tem poucas tentativas locais
const TOPICOS_REFERENCIA_CBMRJ: TopicoRaioX[] = [
  { disciplina: "Língua Portuguesa", topico: "Interpretação e Tipologia Textual", total: 15, acertos: 13, erros: 2, taxa: 87, status: "forte" },
  { disciplina: "Língua Portuguesa", topico: "Ortografia e Acentuação", total: 12, acertos: 11, erros: 1, taxa: 92, status: "forte" },
  { disciplina: "Língua Portuguesa", topico: "Morfossintaxe e Concordância", total: 14, acertos: 9, erros: 5, taxa: 64, status: "evolucao" },
  { disciplina: "Língua Portuguesa", topico: "Crase e Regência Verbal", total: 16, acertos: 6, erros: 10, taxa: 38, status: "critico" },
  { disciplina: "Matemática", topico: "Porcentagem e Regra de Três", total: 10, acertos: 8, erros: 2, taxa: 80, status: "forte" },
  { disciplina: "Matemática", topico: "Geometria Espacial e Volumes", total: 12, acertos: 4, erros: 8, taxa: 33, status: "critico" },
];

export function RaioXDesempenho({ initialWeakness }: RaioXDesempenhoProps) {
  const [diagnostico, setDiagnostico] = React.useState<DiagnosticoRaioX | null>(null);
  const [usandoReferencia, setUsandoReferencia] = React.useState(false);

  const carregarDiagnostico = React.useCallback(() => {
    const diag = calcularRaioXDesempenho();

    if (diag.totalQuestoes >= 3) {
      setDiagnostico(diag);
      setUsandoReferencia(false);
    } else if (initialWeakness && initialWeakness.length > 0) {
      // Converte dados vindos do servidor se existirem
      const pontosFortes: TopicoRaioX[] = [];
      const emEvolucao: TopicoRaioX[] = [];
      const vulnerabilidades: TopicoRaioX[] = [];

      for (const w of initialWeakness) {
        const taxa = Math.round(w.accuracy * 100);
        const item: TopicoRaioX = {
          disciplina: w.subjectName,
          topico: w.topics?.[0]?.topic || `${w.subjectName} Geral`,
          total: w.total,
          acertos: w.correct,
          erros: w.total - w.correct,
          taxa,
          status: taxa >= 75 ? "forte" : taxa >= 50 ? "evolucao" : "critico",
        };
        if (item.status === "forte") pontosFortes.push(item);
        else if (item.status === "evolucao") emEvolucao.push(item);
        else vulnerabilidades.push(item);
      }

      setDiagnostico({
        totalQuestoes: initialWeakness.reduce((acc, cur) => acc + cur.total, 0),
        totalAcertos: initialWeakness.reduce((acc, cur) => acc + cur.correct, 0),
        taxaGeral: 60,
        pontosFortes,
        emEvolucao,
        vulnerabilidades,
        focoRecomendado: vulnerabilidades[0] ?? emEvolucao[0] ?? null,
      });
      setUsandoReferencia(false);
    } else {
      // Fallback pedagógico demonstrativo de calibragem
      const fortes = TOPICOS_REFERENCIA_CBMRJ.filter((t) => t.status === "forte");
      const evolucao = TOPICOS_REFERENCIA_CBMRJ.filter((t) => t.status === "evolucao");
      const criticos = TOPICOS_REFERENCIA_CBMRJ.filter((t) => t.status === "critico");

      setDiagnostico({
        totalQuestoes: 0,
        totalAcertos: 0,
        taxaGeral: 0,
        pontosFortes: fortes,
        emEvolucao: evolucao,
        vulnerabilidades: criticos,
        focoRecomendado: criticos[0] ?? null,
      });
      setUsandoReferencia(true);
    }
  }, [initialWeakness]);

  React.useEffect(() => {
    carregarDiagnostico();
    const handleUpdate = () => carregarDiagnostico();
    window.addEventListener("concursoai_progresso_atualizado", handleUpdate);
    return () => {
      window.removeEventListener("concursoai_progresso_atualizado", handleUpdate);
    };
  }, [carregarDiagnostico]);

  if (!diagnostico) return null;

  const foco = diagnostico.focoRecomendado;

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 p-6 sm:p-7 shadow-xl space-y-6">
      <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* CABEÇALHO DO RAIO-X */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3 py-0.5 text-xs font-bold text-cyan-300">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            Diagnóstico de Retenção & IA
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Raio-X de Desempenho por Tópico
          </h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Mapeamento dinâmico onde você já está forte e onde está vulnerável para direcionar seu estudo com máxima eficiência.
          </p>
        </div>

        {usandoReferencia && (
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 shrink-0">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Modo Demonstração (Calibre resolvendo questões)</span>
          </span>
        )}
      </div>

      {/* CARD DE FOCO RECOMENDADO DA IA */}
      {foco && (
        <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 p-5 shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                ⚠️ Foco Recomendado de Hoje
              </span>
              <span className="text-xs text-slate-400">{foco.disciplina}</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              {foco.topico}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
              Sua taxa atual é de <strong className="text-rose-400 font-mono">{foco.taxa}%</strong>.
              Elevar o domínio deste tópico é o caminho mais rápido para subir sua pontuação na nota de corte do CBM-RJ.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/questoes?palavra=${encodeURIComponent(foco.topico.split(" ")[0] || "")}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 shadow-md shadow-cyan-950 transition-all"
            >
              <span>Treinar Questões</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/questoes?status=errei"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 text-slate-200 text-xs font-semibold px-4 py-2.5 transition-all"
            >
              Caderno de Erros
            </Link>
          </div>
        </div>
      )}

      {/* GRID COM AS 3 COLUNAS DO RAIO-X */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* COLUNA 1: PONTOS FORTES */}
        <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Pontos Fortes (≥ 75%)</span>
            </div>
            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-bold text-emerald-300">
              {diagnostico.pontosFortes.length}
            </span>
          </div>

          {diagnostico.pontosFortes.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">
              Nenhum tópico com taxa acima de 75% ainda. Continue praticando!
            </p>
          ) : (
            <div className="space-y-3.5">
              {diagnostico.pontosFortes.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 line-clamp-1" title={item.topico}>
                      {item.topico}
                    </span>
                    <span className="font-mono font-bold text-emerald-400 tabular-nums">
                      {item.taxa}%
                    </span>
                  </div>
                  <Progress value={item.taxa} className="h-1.5 bg-white/10 [&>div]:bg-emerald-500" />
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{item.disciplina}</span>
                    <span>{item.acertos}/{item.total} acertos</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COLUNA 2: EM EVOLUÇÃO */}
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <TrendingUp className="h-4 w-4" />
              <span>Em Evolução (50% a 74%)</span>
            </div>
            <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-xs font-bold text-cyan-300">
              {diagnostico.emEvolucao.length}
            </span>
          </div>

          {diagnostico.emEvolucao.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">
              Nenhum tópico intermediário no momento.
            </p>
          ) : (
            <div className="space-y-3.5">
              {diagnostico.emEvolucao.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 line-clamp-1" title={item.topico}>
                      {item.topico}
                    </span>
                    <span className="font-mono font-bold text-cyan-400 tabular-nums">
                      {item.taxa}%
                    </span>
                  </div>
                  <Progress value={item.taxa} className="h-1.5 bg-white/10 [&>div]:bg-cyan-500" />
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{item.disciplina}</span>
                    <span>{item.acertos}/{item.total} acertos</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COLUNA 3: VULNERABILIDADES */}
        <div className="rounded-2xl border border-rose-500/30 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <TrendingDown className="h-4 w-4" />
              <span>Vulnerabilidades (&lt; 50%)</span>
            </div>
            <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-xs font-bold text-rose-300">
              {diagnostico.vulnerabilidades.length}
            </span>
          </div>

          {diagnostico.vulnerabilidades.length === 0 ? (
            <p className="text-xs text-emerald-400 font-semibold py-2">
              🎉 Nenhuma vulnerabilidade crítica detectada!
            </p>
          ) : (
            <div className="space-y-3.5">
              {diagnostico.vulnerabilidades.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 line-clamp-1" title={item.topico}>
                      {item.topico}
                    </span>
                    <span className="font-mono font-bold text-rose-400 tabular-nums">
                      {item.taxa}%
                    </span>
                  </div>
                  <Progress value={item.taxa} className="h-1.5 bg-white/10 [&>div]:bg-rose-500" />
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{item.disciplina}</span>
                    <span className="text-rose-400 font-medium">{item.erros} erros acumulados</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RODAPÉ DO RAIO-X: AÇÃO RÁPIDA */}
      <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        <span className="text-slate-400">
          💡 Dica da IA: Pratique os tópicos em vermelho para transformar vulnerabilidades em pontos fortes antes da prova oficial.
        </span>
        <Link
          href="/simulados"
          className="inline-flex items-center gap-1.5 font-bold text-cyan-400 hover:text-cyan-300 hover:underline shrink-0"
        >
          <span>Fazer Simulado Cronometrado</span>
          <span>&rarr;</span>
        </Link>
      </div>
    </section>
  );
}
