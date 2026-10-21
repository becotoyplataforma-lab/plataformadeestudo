"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  X,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRESETS_SIMULADOS,
  type PresetSimulado,
  type QuestaoSimulado,
  type RelatorioSimulado,
  type RespostaAlunoSimulado,
} from "@/lib/simulados/tipos";
import {
  obterHistoricoSimulados,
  registrarTentativaLocal,
  salvarHistoricoSimulado,
  type HistoricoSimulado,
} from "@/lib/questoes/user-storage";
import { cn } from "@/lib/utils";

function formatarTempo(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function SimuladoRunner() {
  const [fase, setFase] = React.useState<"config" | "carregando" | "prova" | "relatorio">("config");
  const [carregandoMensagem, setCarregandoMensagem] = React.useState("Preparando questões do simulado...");

  // Configuração
  const [presetSelecionado, setPresetSelecionado] = React.useState<PresetSimulado>(PRESETS_SIMULADOS[1]!);
  const [modoCustomizado, setModoCustomizado] = React.useState(false);
  const [customTotal, setCustomTotal] = React.useState(20);
  const [customTempo, setCustomTempo] = React.useState(40);
  const [customDisciplinas, setCustomDisciplinas] = React.useState<string[]>([
    "Língua Portuguesa",
    "Matemática",
  ]);

  // Histórico
  const [historico, setHistorico] = React.useState<HistoricoSimulado[]>([]);

  // Prova em andamento
  const [tituloProva, setTituloProva] = React.useState("");
  const [questoes, setQuestoes] = React.useState<QuestaoSimulado[]>([]);
  const [indiceAtual, setIndiceAtual] = React.useState(0);
  const [respostas, setRespostas] = React.useState<Record<string, RespostaAlunoSimulado>>({});
  const [tempoRestanteSegundos, setTempoRestanteSegundos] = React.useState(0);
  const [tempoTotalSegundos, setTempoTotalSegundos] = React.useState(0);
  const [modalFinalizarAberto, setModalFinalizarAberto] = React.useState(false);

  // Relatório pós-prova
  const [relatorio, setRelatorio] = React.useState<RelatorioSimulado | null>(null);
  const [errosSalvosNoCaderno, setErrosSalvosNoCaderno] = React.useState(false);

  // Carrega histórico ao montar
  React.useEffect(() => {
    setHistorico(obterHistoricoSimulados());
  }, []);

  // Timer regressivo da prova
  React.useEffect(() => {
    if (fase !== "prova") return;

    const intervalo = setInterval(() => {
      setTempoRestanteSegundos((prev) => {
        if (prev <= 1) {
          clearInterval(intervalo);
          // Tempo esgotado: auto-entrega da prova
          finalizarProva();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalo);
  }, [fase]);

  async function iniciarSimulado(preset?: PresetSimulado) {
    setFase("carregando");
    setCarregandoMensagem("Sorteando questões reais da banca FGV...");

    try {
      const payload = preset
        ? { presetId: preset.id }
        : {
            totalQuestoes: customTotal,
            duracaoMinutos: customTempo,
            disciplinas: customDisciplinas,
          };

      const res = await fetch("/api/simulados/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Erro na geração do simulado");

      const dados = await res.json();
      setTituloProva(dados.titulo);
      setQuestoes(dados.questoes);
      setTempoTotalSegundos(dados.duracaoMinutos * 60);
      setTempoRestanteSegundos(dados.duracaoMinutos * 60);
      setIndiceAtual(0);

      // Inicializa respostas
      const mapaRespostas: Record<string, RespostaAlunoSimulado> = {};
      for (const q of dados.questoes) {
        mapaRespostas[q.id] = {
          questaoId: q.id,
          letraMarcada: null,
          marcadaParaRevisar: false,
          tempoGastoSegundos: 0,
        };
      }
      setRespostas(mapaRespostas);
      setFase("prova");
    } catch (err) {
      console.error(err);
      alert("Não foi possível gerar o simulado. Verifique sua conexão e tente novamente.");
      setFase("config");
    }
  }

  function marcarAlternativa(letra: string) {
    const q = questoes[indiceAtual];
    if (!q) return;

    setRespostas((prev) => ({
      ...prev,
      [q.id]: {
        ...prev[q.id]!,
        letraMarcada: prev[q.id]?.letraMarcada === letra ? null : letra,
      },
    }));
  }

  function alternarRevisao() {
    const q = questoes[indiceAtual];
    if (!q) return;

    setRespostas((prev) => ({
      ...prev,
      [q.id]: {
        ...prev[q.id]!,
        marcadaParaRevisar: !prev[q.id]?.marcadaParaRevisar,
      },
    }));
  }

  function finalizarProva() {
    setModalFinalizarAberto(false);
    setFase("carregando");
    setCarregandoMensagem("Processando gabarito e calculando nota...");

    const tempoGasto = tempoTotalSegundos - tempoRestanteSegundos;
    let acertos = 0;
    let erros = 0;
    let emBranco = 0;
    const questoesErradasIds: string[] = [];

    const porMateria: Record<
      string,
      { total: number; acertos: number; erros: number; emBranco: number; porcentagem: number }
    > = {};

    for (const q of questoes) {
      const resp = respostas[q.id];
      const mat = q.disciplina || "Geral";
      if (!porMateria[mat]) {
        porMateria[mat] = { total: 0, acertos: 0, erros: 0, emBranco: 0, porcentagem: 0 };
      }
      porMateria[mat].total += 1;

      if (!resp?.letraMarcada) {
        emBranco += 1;
        porMateria[mat].emBranco += 1;
        questoesErradasIds.push(q.id);
        // Registra tentativa em branco como erro de revisão
        registrarTentativaLocal(q.id, "", false);
      } else if (resp.letraMarcada === q.gabarito) {
        acertos += 1;
        porMateria[mat].acertos += 1;
        registrarTentativaLocal(q.id, resp.letraMarcada, true);
      } else {
        erros += 1;
        porMateria[mat].erros += 1;
        questoesErradasIds.push(q.id);
        registrarTentativaLocal(q.id, resp.letraMarcada, false);
      }
    }

    // Calcula porcentagens por matéria
    for (const m of Object.keys(porMateria)) {
      const info = porMateria[m]!;
      info.porcentagem = info.total > 0 ? Math.round((info.acertos / info.total) * 100) : 0;
    }

    const totalQ = questoes.length;
    const porcentagemGeral = totalQ > 0 ? Math.round((acertos / totalQ) * 100) : 0;
    const aprovado = porcentagemGeral >= 60; // Nota de corte padrão concursos

    const rel: RelatorioSimulado = {
      id: "rel-" + Date.now().toString(36),
      titulo: tituloProva,
      totalQuestoes: totalQ,
      respondidas: totalQ - emBranco,
      acertos,
      erros,
      emBranco,
      porcentagemAcerto: porcentagemGeral,
      tempoGastoSegundos: tempoGasto,
      tempoLimiteSegundos: tempoTotalSegundos,
      aprovado,
      porMateria,
      questoesErradasIds,
      dataIso: new Date().toISOString(),
    };

    // Salva no histórico de simulados do usuário
    salvarHistoricoSimulado({
      id: rel.id,
      titulo: rel.titulo,
      totalQuestoes: rel.totalQuestoes,
      acertos: rel.acertos,
      tempoGastoSegundos: rel.tempoGastoSegundos,
      dataIso: rel.dataIso,
      resumoPorMateria: Object.fromEntries(
        Object.entries(porMateria).map(([k, v]) => [k, { total: v.total, acertos: v.acertos }])
      ),
    });

    setRelatorio(rel);
    setHistorico(obterHistoricoSimulados());
    setErrosSalvosNoCaderno(false);
    setFase("relatorio");
  }

  // ============================================================
  // TELA 1: CARREGANDO
  // ============================================================
  if (fase === "carregando") {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center p-8 text-center">
        <div className="relative mb-4">
          <div className="h-16 w-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <Target className="absolute inset-0 m-auto h-7 w-7 text-cyan-400" />
        </div>
        <h3 className="text-lg font-bold text-white">{carregandoMensagem}</h3>
        <p className="mt-1 text-xs text-slate-400">
          Montando folha de respostas, cronômetro e distribuição oficial por matéria.
        </p>
      </div>
    );
  }

  // ============================================================
  // TELA 2: CONFIGURAÇÃO / SELEÇÃO DO SIMULADO
  // ============================================================
  if (fase === "config") {
    return (
      <div className="space-y-10">
        {/* HERO BANNER SIMULADOS */}
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="max-w-2xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3.5 py-1 text-xs font-bold text-cyan-300">
              <Target className="h-3.5 w-3.5" />
              Treino sob Pressão Real
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Simulados Cronometrados CBM-RJ
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Teste seu conhecimento sob pressão real de prova: cronômetro regressivo regressivo,
              folha de respostas rápida, gabarito oficial comentado e envio automático dos seus erros para recuperação.
            </p>
          </div>
        </section>

        {/* PRESETS RECOMENDADOS */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">
                Escolha o Formato da Prova
              </h2>
              <p className="text-xs text-slate-400">
                Selecione um simulado pré-configurado ou monte o seu no formato customizado.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setModoCustomizado(!modoCustomizado)}
              className="text-xs border-white/10 text-cyan-400 hover:text-cyan-300"
            >
              {modoCustomizado ? "Ver Presets Prontos" : "⚙️ Simulado Personalizado"}
            </Button>
          </div>

          {!modoCustomizado ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {PRESETS_SIMULADOS.map((preset) => {
                const isSelected = presetSelecionado.id === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => setPresetSelecionado(preset)}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-2xl border p-6 cursor-pointer transition-all",
                      isSelected
                        ? "border-cyan-400 bg-slate-900 shadow-xl shadow-cyan-950/40 ring-1 ring-cyan-400/50"
                        : "border-white/10 bg-slate-900/70 hover:border-white/20 hover:bg-slate-900"
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                          style={{
                            backgroundColor: `${preset.cor}20`,
                            color: preset.cor,
                            borderColor: `${preset.cor}40`,
                            borderWidth: 1,
                          }}
                        >
                          {preset.badge}
                        </span>
                        {preset.destaque && (
                          <span className="bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-black text-[9px] uppercase px-2 py-0.5 rounded-full">
                            Mais Escolhido
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {preset.titulo}
                      </h3>

                      <p className="text-xs text-slate-400 leading-relaxed">
                        {preset.subtitulo}
                      </p>

                      <div className="space-y-1.5 pt-2 border-t border-white/10 text-xs">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400">Total de Questões:</span>
                          <strong className="text-white font-mono">{preset.totalQuestoes} itens</strong>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400">Tempo de Prova:</span>
                          <strong className="text-white font-mono">{preset.duracaoMinutos} min</strong>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-slate-400">Distribuição:</span>
                          <span className="text-slate-300 font-medium">50% Port. / 50% Mat.</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/10">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          iniciarSimulado(preset);
                        }}
                        className={cn(
                          "w-full text-xs font-bold rounded-xl gap-2",
                          isSelected
                            ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950"
                            : "bg-white/10 hover:bg-white/20 text-white"
                        )}
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        Iniciar Simulado Agora
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* CONFIGURADOR PERSONALIZADO */
            <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 sm:p-7 space-y-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Target className="h-4 w-4 text-cyan-400" />
                Monte Seu Simulado Personalizado
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Número de Questões
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 20, 30, 50].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCustomTotal(n)}
                        className={cn(
                          "rounded-xl py-2 text-xs font-bold transition-all",
                          customTotal === n
                            ? "bg-cyan-600 text-white shadow-md shadow-cyan-950"
                            : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Tempo Limite de Prova
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[15, 30, 45, 60].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCustomTempo(t)}
                        className={cn(
                          "rounded-xl py-2 text-xs font-bold transition-all",
                          customTempo === t
                            ? "bg-cyan-600 text-white shadow-md shadow-cyan-950"
                            : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
                        )}
                      >
                        {t}m
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Disciplinas Inclusas
                  </label>
                  <div className="space-y-2">
                    {["Língua Portuguesa", "Matemática"].map((d) => {
                      const ativo = customDisciplinas.includes(d);
                      return (
                        <label
                          key={d}
                          className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white"
                        >
                          <input
                            type="checkbox"
                            checked={ativo}
                            onChange={() => {
                              if (ativo && customDisciplinas.length === 1) return; // Não permite desmarcar todas
                              setCustomDisciplinas(
                                ativo
                                  ? customDisciplinas.filter((item) => item !== d)
                                  : [...customDisciplinas, d]
                              );
                            }}
                            className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-cyan-500"
                          />
                          <span>{d}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end">
                <Button
                  onClick={() => iniciarSimulado()}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm px-7 py-2.5 rounded-xl gap-2 shadow-md shadow-cyan-950"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Gerar e Iniciar Prova Customizada ({customTotal} itens · {customTempo} min)
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* HISTÓRICO DE SIMULADOS ANTERIORES */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              <h3 className="text-base font-bold text-white">
                Seu Histórico de Simulados
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-semibold tabular-nums">
              {historico.length} {historico.length === 1 ? "prova realizada" : "provas realizadas"}
            </span>
          </div>

          {historico.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-8 text-center">
              <Clock className="mx-auto h-8 w-8 text-slate-500" />
              <p className="mt-2 text-sm text-slate-300 font-semibold">
                Nenhum simulado realizado ainda
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Escolha um formato acima e teste sua performance para começar a acompanhar seu gráfico de evolução.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {historico.slice(0, 6).map((item) => {
                const taxa = Math.round((item.acertos / item.totalQuestoes) * 100);
                const aprovado = taxa >= 60;
                const dataFormatada = new Date(item.dataIso).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-slate-900 p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{dataFormatada}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-bold",
                          aprovado
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        )}
                      >
                        {aprovado ? "Acima do Corte" : "Abaixo do Corte"}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white line-clamp-1">
                      {item.titulo}
                    </h4>

                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <span className="text-2xl font-black text-white tabular-nums">
                          {taxa}%
                        </span>
                        <span className="text-xs text-slate-400 block">
                          {item.acertos} de {item.totalQuestoes} acertos
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        {formatarTempo(item.tempoGastoSegundos)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ============================================================
  // TELA 3: PROVA EM ANDAMENTO (LIVE EXAM RUNNER)
  // ============================================================
  if (fase === "prova") {
    const qAtual = questoes[indiceAtual];
    if (!qAtual) return null;

    const respAtual = respostas[qAtual.id];
    const respondidasCount = Object.values(respostas).filter((r) => r.letraMarcada !== null).length;
    const marcadasRevisarCount = Object.values(respostas).filter((r) => r.marcadaParaRevisar).length;
    const porcentagemConcluida = Math.round((respondidasCount / questoes.length) * 100);

    const tempoPerigo = tempoRestanteSegundos < 300; // Menos de 5 minutos

    return (
      <div className="space-y-6 pb-20">
        {/* TOP BAR FIXA COM CRONÔMETRO E STATUS */}
        <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 bg-slate-950/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 lg:px-8 py-3.5 shadow-xl">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-3 py-0.5 text-xs font-bold">
                <Target className="h-3 w-3" />
                {tituloProva}
              </span>
              <span className="text-xs text-slate-300 font-semibold">
                Questão {indiceAtual + 1} de {questoes.length}
              </span>
            </div>

            {/* CRONÔMETRO REGRESSIVO */}
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-1.5 text-sm font-mono font-bold transition-colors",
                tempoPerigo
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                  : "bg-white/5 border border-white/10 text-white"
              )}
            >
              <Clock className="h-4 w-4 text-cyan-400" />
              <span>{formatarTempo(tempoRestanteSegundos)}</span>
            </div>

            <Button
              size="sm"
              onClick={() => setModalFinalizarAberto(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950"
            >
              Finalizar Simulado
            </Button>
          </div>

          <div className="max-w-7xl mx-auto mt-2">
            <Progress value={porcentagemConcluida} className="h-1 bg-white/10" />
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL: QUESTÃO + FOLHA DE RESPOSTAS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUNA ESQUERDA: CARD DA QUESTÃO ATUAL (8 COLUNAS) */}
          <div className="lg:col-span-8 rounded-2xl border border-white/10 bg-slate-900 p-6 sm:p-7 shadow-xl space-y-6">
            <header className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
              <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 px-3 py-0.5 text-xs font-bold">
                {qAtual.disciplina}
              </span>
              {qAtual.banca && (
                <span className="rounded-full bg-white/5 border border-white/10 text-slate-300 px-2.5 py-0.5 text-xs font-medium">
                  {qAtual.banca}
                </span>
              )}
              {qAtual.ano && (
                <span className="text-xs text-slate-400 tabular-nums">
                  {qAtual.ano}
                </span>
              )}
              {qAtual.assunto && (
                <span className="text-xs text-slate-400">
                  · {qAtual.assunto}
                </span>
              )}
              <span className="ml-auto text-xs font-mono text-slate-500">
                {qAtual.codigo}
              </span>
            </header>

            {/* ENUNCIADO */}
            <div className="text-[15px] sm:text-base text-slate-100 leading-relaxed whitespace-pre-line">
              {qAtual.enunciado}
            </div>

            {/* ALTERNATIVAS CLICÁVEIS */}
            <div className="space-y-3 pt-2">
              {qAtual.alternativas.map((alt) => {
                const selecionada = respAtual?.letraMarcada === alt.letra;
                return (
                  <button
                    key={alt.letra}
                    type="button"
                    onClick={() => marcarAlternativa(alt.letra)}
                    className={cn(
                      "flex w-full items-start gap-3.5 rounded-xl border p-4 text-left text-sm transition-all",
                      selecionada
                        ? "border-cyan-400 bg-cyan-500/15 text-white ring-1 ring-cyan-400 shadow-md shadow-cyan-950/20"
                        : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                        selecionada
                          ? "bg-cyan-400 text-slate-950"
                          : "border border-white/20 text-slate-400 bg-slate-950/50"
                      )}
                    >
                      {alt.letra}
                    </span>
                    <span className="pt-0.5 leading-relaxed">{alt.texto}</span>
                  </button>
                );
              })}
            </div>

            {/* BARRA INFERIOR DE NAVEGAÇÃO DA QUESTÃO */}
            <footer className="flex items-center justify-between pt-4 border-t border-white/10">
              <Button
                size="sm"
                variant="ghost"
                disabled={indiceAtual === 0}
                onClick={() => setIndiceAtual((prev) => Math.max(0, prev - 1))}
                className="text-xs text-slate-400 hover:text-white gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Anterior
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={alternarRevisao}
                className={cn(
                  "text-xs gap-1.5 transition-colors",
                  respAtual?.marcadaParaRevisar
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-300 font-bold"
                    : "border-white/10 text-slate-400 hover:text-white"
                )}
              >
                <Flag className="h-3.5 w-3.5" />
                {respAtual?.marcadaParaRevisar ? "Marcada p/ Revisão" : "Marcar p/ Revisar"}
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  if (indiceAtual < questoes.length - 1) {
                    setIndiceAtual((prev) => prev + 1);
                  } else {
                    setModalFinalizarAberto(true);
                  }
                }}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl gap-1.5 shadow-md shadow-cyan-950"
              >
                {indiceAtual < questoes.length - 1 ? (
                  <>
                    Próxima
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                ) : (
                  "Finalizar Prova"
                )}
              </Button>
            </footer>
          </div>

          {/* COLUNA DIREITA: FOLHA DE RESPOSTAS & GRADE RÁPIDA (4 COLUNAS) */}
          <aside className="lg:col-span-4 rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Folha de Respostas
              </h4>
              <span className="text-xs text-cyan-400 font-bold tabular-nums">
                {respondidasCount} de {questoes.length}
              </span>
            </div>

            {/* LEGENDA */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-cyan-500" />
                <span>Respondida</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border border-amber-400 bg-amber-500/20" />
                <span>Revisar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border border-white/20 bg-white/5" />
                <span>Em branco</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full ring-2 ring-white bg-cyan-500" />
                <span>Atual</span>
              </div>
            </div>

            {/* GRADE DE BOTÕES (1 A N) */}
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 pt-2">
              {questoes.map((q, idx) => {
                const r = respostas[q.id];
                const estaRespondida = r?.letraMarcada !== null;
                const estaRevisar = r?.marcadaParaRevisar;
                const ehAtual = idx === indiceAtual;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setIndiceAtual(idx)}
                    className={cn(
                      "flex h-9 w-full items-center justify-center rounded-xl text-xs font-bold transition-all relative",
                      ehAtual && "ring-2 ring-white scale-105 z-10",
                      estaRespondida
                        ? "bg-cyan-600 text-white shadow-xs"
                        : "border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10",
                      estaRevisar && "border-amber-400 border-2 text-amber-300"
                    )}
                  >
                    <span>{idx + 1}</span>
                    {r?.letraMarcada && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-950 border border-white/20 text-[9px] font-mono text-cyan-300">
                        {r.letraMarcada}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>
        </div>

        {/* MODAL DE CONFIRMAÇÃO DE ENTREGA */}
        <Dialog open={modalFinalizarAberto} onOpenChange={setModalFinalizarAberto}>
          <DialogContent className="max-w-md bg-slate-900 border-white/10 text-white shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <Award className="h-4 w-4 text-cyan-400" />
                Finalizar e Entregar Simulado?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Verifique se preencheu todas as alternativas antes de calcular sua nota.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Total de Questões:</span>
                <strong className="text-white">{questoes.length}</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Respondidas:</span>
                <strong className="text-emerald-400">{respondidasCount}</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Em branco:</span>
                <strong className="text-rose-400">{questoes.length - respondidasCount}</strong>
              </div>
              {marcadasRevisarCount > 0 && (
                <div className="flex justify-between text-amber-300 pt-1 border-t border-white/10">
                  <span>Marcadas para revisão:</span>
                  <strong>{marcadasRevisarCount}</strong>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModalFinalizarAberto(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Voltar à Prova
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={finalizarProva}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Confirmar e Ver Relatório
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ============================================================
  // TELA 4: RELATÓRIO PÓS-PROVA (GABARITO E DESEMPENHO DETALHADO)
  // ============================================================
  if (fase === "relatorio" && relatorio) {
    return (
      <div className="space-y-8 pb-16">
        {/* HERO CARD DE RESULTADO FINAL */}
        <section
          className={cn(
            "rounded-3xl border p-6 sm:p-8 shadow-2xl relative overflow-hidden",
            relatorio.aprovado
              ? "border-emerald-500/40 bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950"
              : "border-rose-500/40 bg-gradient-to-br from-rose-950/50 via-slate-900 to-slate-950"
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-3">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold",
                  relatorio.aprovado
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                )}
              >
                {relatorio.aprovado ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {relatorio.aprovado ? "Acima da Nota de Corte Oficial CBM-RJ" : "Abaixo da Nota de Corte"}
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {relatorio.aprovado ? "Excelente Desempenho! 🎉" : "Simulado Concluído! 🎯"}
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                {relatorio.aprovado
                  ? `Você acertou ${relatorio.acertos} de ${relatorio.totalQuestoes} questões (${relatorio.porcentagemAcerto}%). Com essa pontuação você estaria apto na fase objetiva!`
                  : `Você acertou ${relatorio.acertos} de ${relatorio.totalQuestoes} questões (${relatorio.porcentagemAcerto}%). Aproveite o gabarito comentado abaixo e seu Caderno de Erros para zerar as dúvidas.`}
              </p>
            </div>

            <div className="flex items-center gap-6 shrink-0 bg-slate-950/60 border border-white/10 rounded-2xl p-5">
              <div className="text-center">
                <span className="text-4xl font-black text-white tabular-nums">
                  {relatorio.porcentagemAcerto}%
                </span>
                <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
                  Aproveitamento
                </span>
              </div>

              <div className="h-10 w-px bg-white/10" />

              <div className="text-center">
                <span className="text-xl font-bold text-white font-mono tabular-nums">
                  {formatarTempo(relatorio.tempoGastoSegundos)}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
                  Tempo Gasto
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* MÉTRICAS POR MATÉRIA + CTA CADERNO DE ERROS */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* DESEMPENHO POR MATÉRIA (7 COLUNAS) */}
          <div className="md:col-span-7 rounded-2xl border border-white/10 bg-slate-900 p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              Desempenho por Disciplina
            </h3>

            <div className="space-y-4 pt-2">
              {Object.entries(relatorio.porMateria).map(([materia, info]) => (
                <div key={materia} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{materia}</span>
                    <span className="font-bold text-white tabular-nums">
                      {info.acertos}/{info.total} ({info.porcentagem}%)
                    </span>
                  </div>
                  <Progress value={info.porcentagem} className="h-2 bg-white/10" />
                </div>
              ))}
            </div>
          </div>

          {/* RETENÇÃO: BOTÃO PARA SALVAR ERROS NO CADERNO (5 COLUNAS) */}
          <div className="md:col-span-5 rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-950 p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 text-rose-300 px-2.5 py-0.5 text-xs font-bold">
                <AlertCircle className="h-3 w-3" />
                Ciclo de Retenção Ativa
              </span>
              <h4 className="text-base font-bold text-white">
                Caderno de Erros Automático
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                As {relatorio.erros + relatorio.emBranco} questões que você errou ou deixou em branco
                foram gravadas para treino. Pratique-as até acertar para eliminá-las da sua lista de erros.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/questoes?status=errei"
                className="inline-flex items-center justify-center w-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-2.5 shadow-md shadow-rose-950 transition-all gap-1.5"
              >
                <span>Praticar Questões Erradas Agora</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </div>
        </div>

        {/* GABARITO COMENTADO ITEM A ITEM */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Check className="h-4 w-4 text-cyan-400" />
              Revisão e Gabarito Comentado da Prova
            </h3>
            <span className="text-xs text-slate-400 font-semibold">
              {questoes.length} questões
            </span>
          </div>

          <div className="space-y-4">
            {questoes.map((q, idx) => {
              const r = respostas[q.id];
              const acertou = r?.letraMarcada === q.gabarito;
              const emBranco = !r?.letraMarcada;

              return (
                <div
                  key={q.id}
                  className={cn(
                    "rounded-2xl border p-5 sm:p-6 transition-all bg-slate-900",
                    acertou
                      ? "border-emerald-500/30"
                      : emBranco
                        ? "border-white/10"
                        : "border-rose-500/30"
                  )}
                >
                  <header className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
                    <span className="text-xs font-bold text-white">
                      Questão {idx + 1}
                    </span>
                    <span className="rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2.5 py-0.5 text-xs font-semibold">
                      {q.disciplina}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold">
                      {acertou ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          Você Acertou
                        </span>
                      ) : emBranco ? (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <HelpCircle className="h-4 w-4" />
                          Em Branco
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400">
                          <XCircle className="h-4 w-4" />
                          Você Errou
                        </span>
                      )}
                    </span>
                  </header>

                  <div className="py-4 text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                    {q.enunciado}
                  </div>

                  <div className="space-y-2 pt-1 border-t border-white/10">
                    {q.alternativas.map((alt) => {
                      const ehGabarito = alt.letra === q.gabarito;
                      const foiMarcada = r?.letraMarcada === alt.letra;

                      return (
                        <div
                          key={alt.letra}
                          className={cn(
                            "flex items-start gap-3 rounded-xl border p-3 text-xs leading-relaxed",
                            ehGabarito
                              ? "border-emerald-500/50 bg-emerald-500/10 text-white font-semibold"
                              : foiMarcada && !ehGabarito
                                ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
                                : "border-white/5 bg-white/5 text-slate-300"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                              ehGabarito
                                ? "bg-emerald-500 text-slate-950"
                                : foiMarcada
                                  ? "bg-rose-500 text-white"
                                  : "border border-white/20 text-slate-400"
                            )}
                          >
                            {alt.letra}
                          </span>
                          <span className="pt-0.5">{alt.texto}</span>
                          {ehGabarito && (
                            <span className="ml-auto text-emerald-400 font-bold text-[10px] uppercase">
                              Gabarito Oficial
                            </span>
                          )}
                          {foiMarcada && !ehGabarito && (
                            <span className="ml-auto text-rose-400 font-bold text-[10px] uppercase">
                              Sua Escolha
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* BARRA INFERIOR DE FINALIZAÇÃO */}
        <div className="flex items-center justify-between pt-6 border-t border-white/10">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFase("config")}
            className="border-white/10 text-xs text-slate-300 hover:text-white gap-2"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Novo Simulado
          </Button>

          <Link
            href="/questoes"
            className="inline-flex items-center rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-950 hover:bg-cyan-500 transition-all gap-1.5"
          >
            <span>Voltar ao Caderno de Questões</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
