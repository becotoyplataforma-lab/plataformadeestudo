"use client";

import * as React from "react";
import Link from "next/link";
import { Play, Pause, RotateCcw, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatMinutes } from "@/lib/utils";

const FOCUS_MINUTES = 25;
const BREAK_MINUTES = 5;

type Phase = "focus" | "break";

/**
 * Modo foco (estilo Pomodoro). No MVP, o registro de sessões de estudo
 * pode ser integrado ao cronograma em versões futuras.
 */
export function FocusSession({ userId }: { userId: string }) {
  const [phase, setPhase] = React.useState<Phase>("focus");
  const [secondsLeft, setSecondsLeft] = React.useState(FOCUS_MINUTES * 60);
  const [running, setRunning] = React.useState(false);
  const [completed, setCompleted] = React.useState(0);

  React.useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // Troca de fase
          setRunning(false);
          if (phase === "focus") {
            setCompleted((c) => c + 1);
            setPhase("break");
            setSecondsLeft(BREAK_MINUTES * 60);
          } else {
            setPhase("focus");
            setSecondsLeft(FOCUS_MINUTES * 60);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, phase]);

  const total = phase === "focus" ? FOCUS_MINUTES * 60 : BREAK_MINUTES * 60;
  const progress = Math.round(((total - secondsLeft) / total) * 100);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="w-full max-w-md space-y-6">
      <Card className="overflow-hidden">
        <CardContent className="p-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Badge
              variant={phase === "focus" ? "default" : "success"}
              className="px-3 py-1"
            >
              {phase === "focus" ? "🎯 Foco" : "☕ Pausa"}
            </Badge>
            <Badge variant="secondary">{completed} ciclos</Badge>
          </div>

          {/* Timer */}
          <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                r="88"
                fill="none"
                strokeWidth="10"
                className="stroke-muted"
              />
              <circle
                cx="100"
                cy="100"
                r="88"
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 88}
                strokeDashoffset={2 * Math.PI * 88 * (1 - progress / 100)}
                className={cn(
                  "transition-all duration-1000",
                  phase === "focus" ? "stroke-blue-600" : "stroke-emerald-500"
                )}
              />
            </svg>
            <div className="text-center">
              <p className="text-6xl font-extrabold tabular-nums">
                {mm}:{ss}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {phase === "focus" ? "Hora de estudar" : "Descanse um pouco"}
              </p>
            </div>
          </div>

          {/* Controles */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button
              size="icon"
              className="h-14 w-14 rounded-full"
              onClick={() => setRunning((r) => !r)}
              aria-label={running ? "Pausar" : "Iniciar"}
            >
              {running ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 translate-x-0.5" />
              )}
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-11 w-11 rounded-full"
              onClick={() => {
                setRunning(false);
                setPhase("focus");
                setSecondsLeft(FOCUS_MINUTES * 60);
              }}
              aria-label="Reiniciar"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-11 w-11 rounded-full"
              onClick={() => {
                setRunning(false);
                setPhase(phase === "focus" ? "break" : "focus");
                setSecondsLeft(
                  (phase === "focus" ? BREAK_MINUTES : FOCUS_MINUTES) * 60
                );
              }}
              aria-label="Trocar fase"
            >
              <TimerReset className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Ciclos de {FOCUS_MINUTES} min de foco + {BREAK_MINUTES} min de pausa.
        <br />
        <Link href="/cronograma" className="font-medium text-blue-600 hover:underline">
          Vincular sessões ao cronograma
        </Link>
      </p>
    </div>
  );
}
