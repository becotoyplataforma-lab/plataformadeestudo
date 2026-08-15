"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Section {
  tipo: string;
  titulo: string;
  conteudo: string;
}

const tipoLabel: Record<string, string> = {
  introducao: "Introdução",
  objetivos: "Objetivos",
  explicacao: "Explicação",
  exemplo: "Exemplo",
  ponto_importante: "Ponto importante",
  revisao: "Revisão",
  questao: "Questão",
  encerramento: "Encerramento",
};

export function LessonPlayer({
  lessonId,
  sections,
  initialProgress,
  initialSection,
}: {
  lessonId: string;
  sections: Section[];
  initialProgress: number;
  initialSection: string | null;
}) {
  const [progress, setProgress] = useState(initialProgress);
  const [current, setCurrent] = useState(initialSection ?? sections[0]?.titulo ?? "");
  const [busy, setBusy] = useState(false);

  const percent = Math.round(progress * 100);

  async function advance() {
    const idx = sections.findIndex((s) => s.titulo === current);
    const next = sections[idx + 1];
    const newProgress = next ? Math.min(1, (idx + 2) / sections.length) : 1;
    setBusy(true);
    try {
      await fetch(`/api/lessons/${lessonId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progress: newProgress,
          current_section: next?.titulo ?? current,
          completed: !next,
        }),
      });
      if (next) setCurrent(next.titulo);
      setProgress(newProgress);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between text-sm text-slate-300">
          <span>Progresso</span>
          <span>{percent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-cyan-400 transition-all" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={advance} disabled={busy || progress >= 1} size="sm">
            {progress >= 1 ? "Aula concluída" : "Concluir seção"}
          </Button>
        </div>
      </div>

      {sections.length === 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-500">
          Roteiro vazio.
        </p>
      )}

      {sections.map((s) => (
        <section
          key={`${s.tipo}-${s.titulo}`}
          className={`rounded-2xl border p-4 ${
            s.titulo === current
              ? "border-cyan-400/30 bg-cyan-500/5"
              : "border-white/10 bg-white/5"
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
            {tipoLabel[s.tipo] ?? s.tipo}
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">{s.titulo}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
            {s.conteudo}
          </p>
        </section>
      ))}
    </div>
  );
}
