"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Question {
  id: string;
  subject_name: string | null;
  banca: string | null;
  nivel: string;
  enunciado: string;
  status: string;
  origin: string | null;
  fonte: string | null;
  confidence: number | null;
  created_at: string;
}

export function QuestaoReviewQueue({ documentId }: { documentId?: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Question[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    qs.set("status", "em_revisao");
    if (documentId) qs.set("source_document_id", documentId);
    const res = await fetch(`/api/admin/questions?${qs.toString()}`);
    const data = await res.json();
    setItems(Array.isArray(data?.data) ? data.data : []);
  }, [documentId]);

  useEffect(() => {
    const qs = new URLSearchParams();
    qs.set("status", "em_revisao");
    if (documentId) qs.set("source_document_id", documentId);
    fetch(`/api/admin/questions?${qs.toString()}`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data?.data) ? data.data : []))
      .catch(() => {
        /* sem dados */
      });
  }, [documentId]);

  async function act(id: string, action: "aprovar" | "rejeitar" | "bloquear" | "revisar") {
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/questions/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg(data?.message ?? "Falha na revisão.");
      } else {
        setMsg("Revisão aplicada.");
        await load();
        router.refresh();
      }
    } catch {
      setMsg("Erro de rede.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {msg && <p className="text-sm text-slate-300">{msg}</p>}
      {items.length === 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-500">
          Nenhuma questão aguardando revisão.
        </p>
      )}
      {items.map((q) => (
        <div key={q.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-cyan-200">{q.subject_name ?? "Matéria"}</span>
            {q.banca && <span>{q.banca}</span>}
            <span>{q.nivel}</span>
            {q.confidence != null && <span>confiança {Math.round(q.confidence * 100)}%</span>}
            <span className="text-slate-500">fonte: {q.fonte ?? "—"}</span>
          </div>
          <p className="mt-2 text-sm text-slate-200">{q.enunciado}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => act(q.id, "aprovar")} disabled={busyId === q.id} className="bg-emerald-600 hover:bg-emerald-500">
              Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={() => act(q.id, "rejeitar")} disabled={busyId === q.id} className="border-white/10 bg-white/5 text-slate-100">
              Rejeitar
            </Button>
            <Button size="sm" variant="outline" onClick={() => act(q.id, "bloquear")} disabled={busyId === q.id} className="border-white/10 bg-white/5 text-slate-100">
              Bloquear
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
