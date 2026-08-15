"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface DocItem {
  id: string;
  title: string;
  type: string;
  status: string;
  reviewStatus: string;
  reviewNote: string | null;
  chunkCount: number;
  pageCount: number | null;
  processingError: string | null;
  createdAt: string;
}
interface PreviewChunk {
  seq: number;
  content: string;
  characters: number;
}

export function ReviewQueue({ documents }: { documents: DocItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, PreviewChunk[] | null>>({});
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  async function review(id: string, action: "aprovar" | "rejeitar" | "voltar_pendente") {
    setBusyId(id);
    try {
      await fetch(`/api/admin/documents/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note[id] || undefined }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function loadPreview(id: string) {
    if (previews[id] !== undefined) return;
    setLoadingPreview(id);
    try {
      const res = await fetch(`/api/admin/documents/${id}/preview`);
      const data = await res.json();
      setPreviews((p) => ({ ...p, [id]: data?.preview ?? null }));
    } finally {
      setLoadingPreview(null);
    }
  }

  return (
    <div className="space-y-4">
      {documents.length === 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-500">
          Nenhum material aguardando revisão. 🎉
        </p>
      )}
      {documents.map((d) => (
        <div key={d.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-slate-100">{d.title}</p>
              <p className="text-xs text-slate-400">
                {d.type} · {d.chunkCount} chunks ·{" "}
                {d.pageCount ? `${d.pageCount} páginas` : "sem páginas"}
                {d.reviewStatus === "rejeitado" && d.reviewNote && (
                  <span className="text-rose-300"> · motivo: {d.reviewNote}</span>
                )}
              </p>
              {d.processingError && (
                <p className="text-xs text-rose-300">{d.processingError}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                placeholder="Nota (opcional)"
                value={note[d.id] ?? ""}
                onChange={(e) => setNote((n) => ({ ...n, [d.id]: e.target.value }))}
                className="w-40 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              />
              <Button
                size="sm"
                disabled={busyId === d.id}
                onClick={() => review(d.id, "aprovar")}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                Aprovar
              </Button>
              <Button
                size="sm"
                disabled={busyId === d.id}
                onClick={() => review(d.id, "rejeitar")}
                className="bg-rose-600 hover:bg-rose-500"
              >
                Rejeitar
              </Button>
              {d.reviewStatus !== "pendente" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === d.id}
                  onClick={() => review(d.id, "voltar_pendente")}
                >
                  Voltar p/ pendente
                </Button>
              )}
            </div>
          </div>
          <button
            onClick={() => loadPreview(d.id)}
            className="mt-2 text-xs font-medium text-cyan-300 hover:text-cyan-200"
          >
            {loadingPreview === d.id ? "Carregando..." : "Ver preview do texto extraído"}
          </button>
          {previews[d.id] !== undefined && (
            <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-3 text-xs text-slate-300">
              {previews[d.id] === null ? (
                <p className="text-slate-500">Sem chunks (documento ainda não processado).</p>
              ) : (
                previews[d.id]!.map((c) => (
                  <details key={c.seq}>
                    <summary className="cursor-pointer text-slate-400">
                      Chunk {c.seq} · {c.characters} caracteres
                    </summary>
                    <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-black/30 p-2">
                      {c.content}
                    </pre>
                  </details>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
