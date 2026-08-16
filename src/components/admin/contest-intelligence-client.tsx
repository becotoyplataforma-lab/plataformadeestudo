"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EditalOption {
  id: string;
  title: string;
  contestTitle: string | null;
}
interface Analysis {
  editalTitle: string;
  banca: string | null;
  bancaConhecida: boolean;
  materias: { subjectName: string; weight: number }[];
  historico: { subjectName: string; count: number; sharePercent: number }[];
  totalHistorico: number;
  historicoSuficiente: boolean;
}

export function ContestIntelligenceClient({ editais }: { editais: EditalOption[] }) {
  const [editalId, setEditalId] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (!editalId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contest-intelligence?edital_id=${editalId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha na análise.");
        setAnalysis(null);
        return;
      }
      setAnalysis(data);
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-400">Edital</label>
          <select
            value={editalId}
            onChange={(e) => setEditalId(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">Selecione um edital importado</option>
            {editais.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
                {e.contestTitle ? ` — ${e.contestTitle}` : ""}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={analyze} disabled={busy || !editalId}>
          {busy ? "Analisando..." : "Analisar"}
        </Button>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      {analysis && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-sm text-slate-200">
                Peso por matéria no edital
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {analysis.materias.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Nenhuma matéria/peso cadastrada neste edital (pendente de importação).
                </p>
              ) : (
                analysis.materias.map((m) => (
                  <div key={m.subjectName} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-slate-200">{m.subjectName}</span>
                    <div className="h-2 w-40 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan-400/70"
                        style={{ width: `${Math.min(100, m.weight)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs text-slate-400">{m.weight}%</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-sm text-slate-200">
                Histórico da banca {analysis.banca ? `(${analysis.banca})` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!analysis.bancaConhecida ? (
                <p className="text-sm text-slate-400">
                  Banca não confirmada neste edital — sem histórico confiável para exibir.
                </p>
              ) : !analysis.historicoSuficiente ? (
                <p className="text-sm text-slate-400">
                  Ainda há poucas questões dessa banca no banco ({analysis.totalHistorico}).
                  O padrão histórico será exibido quando houver mais dados.
                </p>
              ) : (
                analysis.historico.map((h) => (
                  <div key={h.subjectName} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-slate-200">{h.subjectName}</span>
                    <span className="text-xs text-slate-400">{h.count} questões</span>
                    <span className="text-xs text-cyan-300">{h.sharePercent}%</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
