"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ApostilaActions({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function reprocess() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/knowledge/documents/${documentId}/process`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.message ?? data?.error ?? "Falha no reprocessamento.");
      } else {
        setMsg(`Reprocessado (status: ${data?.document?.status ?? data?.pipeline?.status ?? "?"}).`);
        router.refresh();
      }
    } catch {
      setMsg("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  async function transformar() {
    setTransforming(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/knowledge/documents/${documentId}/transformar`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.message ?? data?.error ?? "Falha na transformação.");
      } else {
        setMsg("Transformada no layout em fases com a marca DeepSeek.");
        router.refresh();
      }
    } catch {
      setMsg("Erro de rede.");
    } finally {
      setTransforming(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={transformar}
          disabled={transforming}
          className="border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
        >
          {transforming
            ? "Transformando..."
            : "✨ Transformar com IA (fases + DeepSeek)"}
        </Button>
        <Button variant="outline" onClick={reprocess} disabled={busy} className="border-white/10 bg-white/5 text-slate-100">
          {busy ? "Processando..." : "Reprocessar"}
        </Button>
      </div>
      {msg && <p className="max-w-xs text-right text-xs text-slate-400">{msg}</p>}
    </div>
  );
}
