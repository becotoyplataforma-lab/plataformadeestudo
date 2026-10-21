"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Filter,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { QuestaoCard } from "@/components/questoes/questao-card";
import { Paginacao } from "@/components/questoes/paginacao";
import {
  limparCadernoDeErros,
  obterCadernosPersonalizados,
  obterIdsAcertados,
  obterIdsComErro,
  obterIdsResolvidos,
  type CadernoPersonalizado,
} from "@/lib/questoes/user-storage";
import type { LoteProcedencia } from "@/lib/questoes/cadernos";
import type { QuestaoExtraida } from "@/lib/questoes/procedencia";
import { rotasQuestoes } from "@/lib/questoes/rotas";

export interface ItemComLote {
  questao: QuestaoExtraida;
  lote?: LoteProcedencia;
}

export interface QuestoesFeedViewProps {
  visiveis: ItemComLote[];
  todosItens: ItemComLote[];
  statusParam?: string;
  cadernoParam?: string;
  filtros: any;
  pagina: any;
  caminhoBase?: string;
}

export function QuestoesFeedView({
  visiveis,
  todosItens,
  statusParam,
  cadernoParam,
  filtros,
  pagina,
  caminhoBase = "/questoes",
}: QuestoesFeedViewProps) {
  const [errosIds, setErrosIds] = React.useState<string[]>([]);
  const [acertosIds, setAcertosIds] = React.useState<string[]>([]);
  const [resolvidosIds, setResolvidosIds] = React.useState<string[]>([]);
  const [cadernos, setCadernos] = React.useState<CadernoPersonalizado[]>([]);
  const [montado, setMontado] = React.useState(false);

  const carregarProgresso = React.useCallback(() => {
    setErrosIds(obterIdsComErro());
    setAcertosIds(obterIdsAcertados());
    setResolvidosIds(obterIdsResolvidos());
    setCadernos(obterCadernosPersonalizados());
  }, []);

  React.useEffect(() => {
    carregarProgresso();
    setMontado(true);
    const handleProgresso = () => carregarProgresso();
    window.addEventListener("concursoai_progresso_atualizado", handleProgresso);
    window.addEventListener("concursoai_cadernos_atualizado", handleProgresso);
    return () => {
      window.removeEventListener("concursoai_progresso_atualizado", handleProgresso);
      window.removeEventListener("concursoai_cadernos_atualizado", handleProgresso);
    };
  }, [carregarProgresso]);

  // Se estiver filtrando por Caderno Personalizado
  const cadernoAtivo = cadernoParam
    ? cadernos.find((c) => c.id === cadernoParam)
    : null;

  // Filtragem dinâmica por status ou caderno se solicitado
  let itensFiltrados = visiveis;
  let modoEspecial: "erros" | "caderno" | "acertos" | "nao_resolvidas" | "resolvidas" | null = null;

  if (montado) {
    if (statusParam === "errei") {
      modoEspecial = "erros";
      const setErros = new Set(errosIds);
      itensFiltrados = todosItens.filter((it) => setErros.has(it.questao.id_local));
    } else if (statusParam === "acertei") {
      modoEspecial = "acertos";
      const setAcertos = new Set(acertosIds);
      itensFiltrados = todosItens.filter((it) => setAcertos.has(it.questao.id_local));
    } else if (statusParam === "resolvidas") {
      modoEspecial = "resolvidas";
      const setResolv = new Set(resolvidosIds);
      itensFiltrados = todosItens.filter((it) => setResolv.has(it.questao.id_local));
    } else if (statusParam === "nao_resolvidas") {
      modoEspecial = "nao_resolvidas";
      const setResolv = new Set(resolvidosIds);
      itensFiltrados = visiveis.filter((it) => !setResolv.has(it.questao.id_local));
    } else if (cadernoAtivo) {
      modoEspecial = "caderno";
      const setCad = new Set(cadernoAtivo.questoesIds);
      itensFiltrados = todosItens.filter((it) => setCad.has(it.questao.id_local));
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. HERO BANNER DO CADERNO DE ERROS AUTOMÁTICO */}
      {modoEspecial === "erros" && (
        <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-950 p-5 sm:p-6 shadow-xl shadow-rose-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 px-3 py-0.5 text-xs font-bold text-rose-300">
                <AlertCircle className="h-3.5 w-3.5" />
                Caderno de Erros Automático
              </div>
              <h3 className="text-lg font-black text-white">
                Foco em Retenção: {itensFiltrados.length}{" "}
                {itensFiltrados.length === 1 ? "questão com erro" : "questões com erro"}
              </h3>
              <p className="text-xs text-slate-300 max-w-xl">
                Resolva novamente as questões que você errou. Ao acertar, a questão sai automaticamente desta lista até você zerar seus erros!
              </p>
            </div>

            <div className="flex items-center gap-2">
              {itensFiltrados.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm("Deseja zerar todas as questões com erro?")) {
                      limparCadernoDeErros();
                      carregarProgresso();
                    }
                  }}
                  className="border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/10"
                >
                  Zerar erros
                </Button>
              )}
              <Link
                href={caminhoBase}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline px-3 py-1.5"
              >
                Voltar a todas as questões &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 2. HERO BANNER DE CADERNO PERSONALIZADO */}
      {modoEspecial === "caderno" && cadernoAtivo && (
        <div
          className="rounded-2xl border p-5 sm:p-6 shadow-xl"
          style={{
            borderColor: `${cadernoAtivo.cor}40`,
            background: `linear-gradient(135deg, ${cadernoAtivo.cor}15 0%, rgba(15,23,42,0.9) 100%)`,
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold"
                style={{
                  backgroundColor: `${cadernoAtivo.cor}25`,
                  color: cadernoAtivo.cor,
                  borderColor: `${cadernoAtivo.cor}50`,
                  borderWidth: 1,
                }}
              >
                <Bookmark className="h-3.5 w-3.5" />
                Caderno Personalizado
              </div>
              <h3 className="text-lg font-black text-white">
                {cadernoAtivo.nome} ({itensFiltrados.length}{" "}
                {itensFiltrados.length === 1 ? "questão" : "questões"})
              </h3>
              {cadernoAtivo.descricao && (
                <p className="text-xs text-slate-300 max-w-xl">
                  {cadernoAtivo.descricao}
                </p>
              )}
            </div>

            <Link
              href={caminhoBase}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
            >
              Voltar ao filtro geral &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* 3. HERO BANNER DE QUESTÕES ACERTADAS */}
      {modoEspecial === "acertos" && (
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 text-emerald-300 px-3 py-0.5 text-xs font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Suas Vitórias ({itensFiltrados.length})
              </div>
              <h3 className="text-base font-bold text-white">
                Questões que você já acertou
              </h3>
            </div>
            <Link
              href={caminhoBase}
              className="text-xs font-semibold text-cyan-400 hover:underline"
            >
              Ver todas &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* 4. FEED DE CARDS */}
      {itensFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/50 p-12 text-center shadow-xs">
          {modoEspecial === "erros" ? (
            <>
              <Trophy className="mx-auto h-12 w-12 text-emerald-400 animate-bounce" />
              <h3 className="mt-3 text-base font-bold text-white">
                🎉 Parabéns! Seu Caderno de Erros está zerado!
              </h3>
              <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                Você não possui nenhuma questão errada pendente de revisão. Continue resolvendo questões no filtro geral para manter o ritmo!
              </p>
              <div className="mt-4">
                <Link
                  href={caminhoBase}
                  className="inline-flex items-center rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-cyan-500 transition-all"
                >
                  Voltar ao filtro de questões
                </Link>
              </div>
            </>
          ) : modoEspecial === "caderno" ? (
            <>
              <Bookmark className="mx-auto h-12 w-12 text-slate-500" />
              <h3 className="mt-3 text-base font-bold text-white">
                Este caderno ainda não possui questões
              </h3>
              <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                Navegue pelo banco de questões e clique no botão <strong>"Caderno"</strong> em cada card para adicionar questões a este grupo.
              </p>
              <div className="mt-4">
                <Link
                  href={caminhoBase}
                  className="inline-flex items-center rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-cyan-500 transition-all"
                >
                  Explorar questões
                </Link>
              </div>
            </>
          ) : (
            <>
              <HelpCircle className="mx-auto h-12 w-12 text-slate-500" />
              <h3 className="mt-3 text-base font-bold text-white">
                Nenhuma questão encontrada com esses filtros
              </h3>
              <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                Tente selecionar menos filtros ou clique em "Limpar" para voltar a ver todas as questões do acervo.
              </p>
              <div className="mt-4">
                <Link
                  href={caminhoBase}
                  className="inline-flex items-center rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-cyan-500 transition-all"
                >
                  Limpar todos os filtros
                </Link>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {itensFiltrados.map(({ questao, lote }) => (
            <QuestaoCard
              key={questao.id_local}
              questao={questao}
              lote={lote}
              hrefDetalhe={rotasQuestoes.questao(questao.id_local)}
            />
          ))}

          {!modoEspecial && (
            <Paginacao
              slug="geral"
              filtros={filtros}
              pagina={pagina}
              caminhoBase={caminhoBase}
            />
          )}
        </div>
      )}
    </div>
  );
}
