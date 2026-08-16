"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface Criterion {
  nome: string;
  nota: number;
  comentario: string;
}
interface Result {
  notaTotal: number;
  criterios: Criterion[];
  comentarioGeral: string;
}

export function EssayCorrectionForm() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/essay/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha na correção.");
        return;
      }
      setResult(data);
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-sm text-slate-200">Sua redação</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole aqui o texto da sua redação (mínimo 120 caracteres)..."
              rows={12}
              className="bg-slate-900 text-slate-200"
            />
            <Button type="submit" disabled={busy || text.trim().length < 120}>
              {busy ? "Corrigindo..." : "Corrigir redação"}
            </Button>
            {error && <p className="text-sm text-rose-300">{error}</p>}
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="flex items-baseline gap-3 text-sm text-slate-200">
              Nota estimada
              <span className="text-2xl font-black text-cyan-300">{result.notaTotal}</span>
              <span className="text-xs text-slate-400">/ 1000</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.criterios.map((c) => (
              <div key={c.nome} className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">{c.nome}</span>
                  <span className="text-xs font-bold text-slate-300">{c.nota}/200</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{c.comentario}</p>
              </div>
            ))}
            {result.comentarioGeral && (
              <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-cyan-300">Comentário geral</p>
                <p className="mt-1 text-sm text-slate-300">{result.comentarioGeral}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
