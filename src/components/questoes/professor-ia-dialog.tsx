"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Copy,
  ExternalLink,
  Layers,
  Loader2,
  MessageSquare,
  Sparkles,
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { QuestaoExtraida } from "@/lib/questoes/procedencia";
import { salvarFlashcardLocal, questaoTemFlashcard } from "@/lib/questoes/user-storage";
import { toast } from "sonner";

export interface QuestaoParaExplicacao {
  id_local: string;
  enunciado: string;
  alternativas: Record<string, string>;
  gabarito: string;
  disciplina?: string;
  assunto?: string | null;
  banca?: string | null;
  ano?: number | null;
}

export interface ProfessorIaDialogProps {
  questao: QuestaoExtraida | QuestaoParaExplicacao;
  letraMarcada?: string | null;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
}

export function ProfessorIaDialog({
  questao,
  letraMarcada,
  aberto,
  onOpenChange,
}: ProfessorIaDialogProps) {
  const [carregando, setCarregando] = React.useState(false);
  const [explicacao, setExplicacao] = React.useState<string | null>(null);
  const [flashcardCriado, setFlashcardCriado] = React.useState(false);

  const obterExplicacao = React.useCallback(async () => {
    setCarregando(true);
    setExplicacao(null);

    try {
      const res = await fetch("/api/questoes/explicar-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questaoId: questao.id_local,
          enunciado: questao.enunciado,
          alternativas: Object.entries(questao.alternativas).map(([letra, texto]) => ({
            letra,
            texto,
          })),
          gabarito: questao.gabarito,
          letraMarcada: letraMarcada ?? null,
          disciplina: questao.disciplina,
          assunto: questao.assunto,
          banca: questao.banca,
        }),
      });

      if (!res.ok) throw new Error("Falha ao consultar Professor IA");

      const data = await res.json();
      setExplicacao(data.explicacao || "Explicação não disponível no momento.");
    } catch (err) {
      console.error(err);
      setExplicacao("Não foi possível gerar a explicação por IA no momento. Tente novamente em instantes.");
    } finally {
      setCarregando(false);
    }
  }, [questao, letraMarcada]);

  React.useEffect(() => {
    if (aberto) {
      setFlashcardCriado(questaoTemFlashcard(questao.id_local));
      obterExplicacao();
    }
  }, [aberto, questao.id_local, obterExplicacao]);

  function criarFlashcardRapido() {
    const frente = `[${questao.disciplina || "Geral"}${questao.assunto ? " · " + questao.assunto : ""}] Como resolver o comando:\n\n${questao.enunciado.slice(0, 180)}...`;
    const verso = `Gabarito Oficial: Alternativa (${questao.gabarito})\n\nConceito-chave: ${questao.assunto || questao.disciplina || "Conteúdo Oficial"}\n\n${explicacao?.slice(0, 300) || "Revise o conceito correspondente no material oficial."}`;

    salvarFlashcardLocal({
      questaoId: questao.id_local,
      frente,
      verso,
      disciplina: questao.disciplina,
      assunto: questao.assunto ?? undefined,
    });

    // Sincroniza com o backend se usuário estiver logado
    try {
      fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: frente,
          back: verso,
          tags: [questao.disciplina || "Geral", questao.banca || "FGV"].filter(Boolean),
        }),
      }).catch(() => {});
    } catch {}

    setFlashcardCriado(true);
    toast.success("Flashcard criado e adicionado à sua fila de repetição espaçada! 🎉");
  }

  const acertou = letraMarcada && letraMarcada === questao.gabarito;
  const errou = letraMarcada && letraMarcada !== questao.gabarito;

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-900 border-white/10 text-white shadow-2xl p-6 sm:p-7">
        <DialogHeader className="border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-3 py-0.5 text-xs font-bold text-cyan-300">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              Tutor ConcursoAI
            </span>
            <span className="text-xs text-slate-400">
              {questao.disciplina} {questao.assunto ? `· ${questao.assunto}` : ""}
            </span>
          </div>
          <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
            Explicação com Professor IA
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Resolução comentada, análise das armadilhas da banca e passo a passo didático.
          </DialogDescription>
        </DialogHeader>

        {/* STATUS DA RESPOSTA DO ALUNO */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Sua marcação:</span>
            {letraMarcada ? (
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                  acertou
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`}
              >
                Alternativa ({letraMarcada}) {acertou ? "✓ Acertou" : "✗ Incorreta"}
              </span>
            ) : (
              <span className="text-slate-400 italic">Não respondida</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Gabarito oficial:</span>
            <span className="font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-md">
              Alternativa ({questao.gabarito})
            </span>
          </div>
        </div>

        {/* CORPO DA EXPLICAÇÃO */}
        <div className="space-y-4 py-2">
          {carregando ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="relative">
                <Loader2 className="h-9 w-9 text-cyan-400 animate-spin" />
                <Sparkles className="absolute inset-0 m-auto h-4 w-4 text-cyan-300" />
              </div>
              <p className="text-sm font-semibold text-white">
                O Professor IA está analisando sua questão...
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                Identificando a pegadinha da alternativa marcada e estruturando o raciocínio correto.
              </p>
            </div>
          ) : explicacao ? (
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-200 leading-relaxed space-y-3 prose prose-invert prose-cyan max-w-none">
              <div className="whitespace-pre-line text-[13px] sm:text-sm">
                {explicacao}
              </div>
            </div>
          ) : null}
        </div>

        {/* AÇÕES DE RETENÇÃO NO RODAPÉ */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            {!flashcardCriado ? (
              <Button
                type="button"
                size="sm"
                onClick={criarFlashcardRapido}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1.5 shadow-sm shadow-amber-950"
              >
                <Layers className="h-3.5 w-3.5" />
                Criar Flashcard deste Conceito
              </Button>
            ) : (
              <Link
                href="/flashcards"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3.5 py-1.5 text-xs font-bold hover:bg-emerald-500/30 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Flashcard Criado! Praticar &rarr;
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Link
              href={`/professor?pergunta=${encodeURIComponent(
                `Professor, fiquei com dúvida nesta questão de ${questao.disciplina || "concurso"}: "${questao.enunciado.slice(0, 120)}..."`
              )}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline px-3 py-1.5"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Tirar Dúvida no Chat &rarr;
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs border-white/10 text-slate-400 hover:text-white"
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
