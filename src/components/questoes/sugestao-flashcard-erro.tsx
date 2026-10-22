"use client";

import * as React from "react";
import Link from "next/link";
import { Check, CheckCircle2, Layers, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuestaoExtraida } from "@/lib/questoes/procedencia";
import { questaoTemFlashcard, salvarFlashcardLocal } from "@/lib/questoes/user-storage";
import { toast } from "sonner";

export interface SugestaoFlashcardErroProps {
  questao: QuestaoExtraida;
  letraMarcada?: string | null;
  onAbrirProfessorIa?: () => void;
}

export function SugestaoFlashcardErro({
  questao,
  letraMarcada,
  onAbrirProfessorIa,
}: SugestaoFlashcardErroProps) {
  const [visivel, setVisivel] = React.useState(true);
  const [criado, setCriado] = React.useState(false);
  const [carregando, setCarregando] = React.useState(false);

  React.useEffect(() => {
    setCriado(questaoTemFlashcard(questao.id_local));
  }, [questao.id_local]);

  if (!visivel) return null;

  async function criarFlashcard1Clique() {
    setCarregando(true);
    try {
      const altGabarito =
        questao.alternativas[questao.gabarito as keyof typeof questao.alternativas] ||
        `Alternativa (${questao.gabarito})`;

      const frente = `[${questao.disciplina || "Geral"}${questao.assunto ? " · " + questao.assunto : ""}] Como resolver:\n\n"${questao.enunciado.slice(0, 160)}..."`;
      const verso = `Gabarito Oficial: (${questao.gabarito}) - ${altGabarito}\n\nConceito-chave: ${questao.assunto || "Regra essencial do edital CBM-RJ"}. Cuidado com a pegadinha da alternativa (${letraMarcada || "errada"}).`;

      salvarFlashcardLocal({
        questaoId: questao.id_local,
        frente,
        verso,
        disciplina: questao.disciplina,
        assunto: questao.assunto ?? undefined,
      });

      // Dispara envio ao backend em background
      fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: frente,
          back: verso,
          tags: [questao.disciplina || "Geral", "Erro-Revisão"].filter(Boolean),
        }),
      }).catch(() => {});

      setCriado(true);
      toast.success("Flashcard criado! Adicionado à sua rotina de repetição espaçada. 🎯");
    } catch {
      toast.error("Erro ao criar flashcard.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mt-3.5 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 p-3.5 sm:p-4 text-xs transition-all shadow-md shadow-amber-950/20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[11px]">
              💡
            </span>
            <span>Fixe este conceito na memória de longo prazo</span>
          </div>
          <p className="text-slate-300 text-[11px] sm:text-xs leading-relaxed max-w-xl">
            Você errou esta questão. Que tal gerar um Flashcard instantâneo com a regra cobrada para nunca mais cair nessa pegadinha?
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!criado ? (
            <Button
              size="sm"
              type="button"
              disabled={carregando}
              onClick={criarFlashcard1Clique}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl gap-1.5 shadow-sm shadow-amber-950 transition-all"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Criar Flashcard com 1 Clique</span>
            </Button>
          ) : (
            <Link
              href="/flashcards"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3.5 py-1.5 text-xs font-bold hover:bg-emerald-500/30 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Flashcard Salvo! Praticar &rarr;</span>
            </Link>
          )}

          {onAbrirProfessorIa && (
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={onAbrirProfessorIa}
              className="border-cyan-500/30 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-300 text-xs gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Explicar Erro</span>
            </Button>
          )}

          <button
            type="button"
            onClick={() => setVisivel(false)}
            title="Ignorar sugestão"
            className="text-slate-500 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
