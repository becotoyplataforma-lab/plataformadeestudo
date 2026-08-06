"use client";

import * as React from "react";
import { toast } from "sonner";
import { BookOpen, Check, Loader2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Question } from "@/types";

interface Props {
  question: Question;
  userId: string;
}

type AnswerState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "answered"; selected: string; correct: boolean; explicacao: string | null };

export function QuestionCard({ question }: Props) {
  const [state, setState] = React.useState<AnswerState>({ status: "idle" });

  const options = question.options ?? [];

  async function answer(letter: string) {
    if (state.status !== "idle") return;
    // Date.now() roda em event handler (onClick), não em render — falso positivo da regra.
    // eslint-disable-next-line react-hooks/purity
    const answeredAt = Date.now();
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/questoes/${question.id}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_letter: letter,
          // eslint-disable-next-line react-hooks/purity
          time_spent_sec: Math.round((Date.now() - answeredAt) / 1000),
          mode: "estudo",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao registrar resposta.");
        setState({ status: "idle" });
        return;
      }
      setState({
        status: "answered",
        selected: letter,
        correct: data.correct,
        explicacao: data.explicacao,
      });
    } catch {
      toast.error("Erro de conexão.");
      setState({ status: "idle" });
    }
  }

  const answered = state.status === "answered";
  const showFeedback = answered || state.status === "loading";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        {/* Cabeçalho da questão */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {question.subject && (
            <Badge
              variant="secondary"
              style={{
                backgroundColor: question.subject.color
                  ? `${question.subject.color}22`
                  : undefined,
                color: question.subject.color ?? undefined,
              }}
            >
              {question.subject.name}
            </Badge>
          )}
          {question.banca && <Badge variant="outline">{question.banca}</Badge>}
          <Badge
            variant={
              question.nivel === "facil"
                ? "success"
                : question.nivel === "medio"
                  ? "warning"
                  : "destructive"
            }
          >
            {question.nivel === "facil"
              ? "Fácil"
              : question.nivel === "medio"
                ? "Médio"
                : "Difícil"}
          </Badge>
          {question.ano && (
            <span className="ml-auto text-xs text-muted-foreground">
              {question.ano}
            </span>
          )}
        </div>

        {/* Enunciado */}
        <p className="mb-4 text-sm leading-relaxed">{question.enunciado}</p>

        {/* Alternativas */}
        <div className="space-y-2">
          {options.map((opt) => {
            const isSelected = answered && state.selected === opt.letter;
            const isGabarito = answered && opt.letter === question.gabarito;
            return (
              <button
                key={opt.id}
                disabled={showFeedback}
                onClick={() => answer(opt.letter)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                  !showFeedback &&
                    "hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30",
                  isSelected && !isGabarito && "border-red-400 bg-red-50 dark:bg-red-950/30",
                  isGabarito && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                    isGabarito && "border-emerald-500 bg-emerald-500 text-white",
                    isSelected && !isGabarito && "border-red-400 bg-red-400 text-white"
                  )}
                >
                  {opt.letter}
                </span>
                <span className="flex-1">{opt.text}</span>
                {isGabarito && <Check className="h-4 w-4 text-emerald-600" />}
                {isSelected && !isGabarito && (
                  <X className="h-4 w-4 text-red-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {state.status === "loading" && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Registrando resposta...
          </p>
        )}
        {answered && (
          <div
            className={cn(
              "mt-4 rounded-lg border p-4",
              state.correct
                ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-amber-200 bg-amber-50 dark:bg-amber-950/30"
            )}
          >
            <p
              className={cn(
                "mb-1 flex items-center gap-2 font-semibold",
                state.correct ? "text-emerald-700" : "text-amber-700"
              )}
            >
              {state.correct ? (
                <>
                  <Check className="h-4 w-4" /> Acertou! 🎉
                </>
              ) : (
                <>
                  <X className="h-4 w-4" /> Errou — gabarito: {question.gabarito}
                </>
              )}
            </p>
            {state.explicacao && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {state.explicacao}
              </p>
            )}
          </div>
        )}

        {!showFeedback && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            Clique em uma alternativa para responder
            {question.explicacao && (
              <>
                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                explicação incluída
              </>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
