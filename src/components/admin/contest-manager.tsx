"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface ContestRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  organId: string | null;
  boardId: string | null;
}

export function ContestManager({ initial }: { initial: ContestRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function softDelete(id: string, title: string) {
    if (!confirm(`Excluir (soft) o concurso "${title}"? Os dados não serão apagados.`)) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/contests/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha ao excluir concurso.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-rose-300">{error}</p>}
      {initial.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-200">{c.title}</p>
            <p className="text-xs text-slate-500">
              {c.status} · {c.slug}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-300 hover:bg-white/10"
            disabled={busyId === c.id}
            onClick={() => softDelete(c.id, c.title)}
          >
            {busyId === c.id ? "..." : "Excluir"}
          </Button>
        </div>
      ))}
      {initial.length === 0 && <p className="text-sm text-slate-500">Nenhum concurso cadastrado.</p>}
    </div>
  );
}
