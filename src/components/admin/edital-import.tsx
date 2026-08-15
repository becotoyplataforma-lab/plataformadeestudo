"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Doc {
  id: string;
  title: string;
  status: string;
}
interface Contest {
  id: string;
  title: string;
}
interface Suggestion {
  banca?: string;
  cargo?: string;
  dataProva?: string;
  materias: { name: string; weight: number }[];
}

export function EditalImport({
  documents,
  contests,
}: {
  documents: Doc[];
  contests: Contest[];
}) {
  const router = useRouter();
  const [documentId, setDocumentId] = useState("");
  const [contestId, setContestId] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const docs = documents.filter((d) => d.status === "chunked" || d.status === "indexed");

  async function analyze() {
    if (!documentId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setSuggestion(null);
    try {
      const res = await fetch("/api/admin/editais/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha ao analisar.");
        return;
      }
      setSuggestion(data.suggestions);
      setMessage("Estrutura extraída. Revise os pesos e confirme abaixo.");
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  function updateWeight(i: number, weight: number) {
    setSuggestion((s) => {
      if (!s) return s;
      const materias = s.materias.map((m, idx) => (idx === i ? { ...m, weight } : m));
      return { ...s, materias };
    });
  }

  async function apply() {
    if (!documentId || !contestId || !suggestion) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/editais/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: documentId,
          contest_id: contestId,
          title: suggestion.banca ? `${suggestion.banca} — ${suggestion.cargo ?? ""}`.trim() : undefined,
          banca: suggestion.banca,
          materias: suggestion.materias,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha ao aplicar.");
        return;
      }
      setMessage(`Aplicado: ${data.appliedCount} matéria(s) vinculada(s) ao edital.`);
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle className="text-sm text-slate-200">1 · Escolher documento do edital</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">Edital (processado)</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <select
            value={contestId}
            onChange={(e) => setContestId(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">Concurso destino</option>
            {contests.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <Button onClick={analyze} disabled={busy || !documentId}>
            {busy ? "Analisando..." : "Analisar com IA"}
          </Button>
        </div>

        {suggestion && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
            <div className="flex flex-wrap gap-3 text-sm">
              {suggestion.banca && <span className="text-slate-300">Banca: <b>{suggestion.banca}</b></span>}
              {suggestion.cargo && <span className="text-slate-300">Cargo: <b>{suggestion.cargo}</b></span>}
              {suggestion.dataProva && <span className="text-slate-300">Data: <b>{suggestion.dataProva}</b></span>}
            </div>
            <p className="text-xs text-slate-400">Ajuste os pesos e confirme:</p>
            <div className="space-y-2">
              {suggestion.materias.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-slate-200">{m.name}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={m.weight}
                    onChange={(e) => updateWeight(i, Number(e.target.value))}
                    className="w-20 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-200"
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
              ))}
            </div>
            <Button onClick={apply} disabled={applying || !contestId} className="mt-2">
              {applying ? "Aplicando..." : "Aplicar no edital"}
            </Button>
          </div>
        )}

        {message && <p className="text-sm text-emerald-300">{message}</p>}
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </CardContent>
    </Card>
  );
}
