"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface ApostilaListItem {
  id: string;
  title: string;
  type: string;
  status: string;
  chunkCount: number;
  pageCount: number | null;
  sourceType: string;
  reviewStatus: string;
  subjectId?: string;
  subjectName?: string;
}

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  processed: "Processado",
  chunked: "Conteúdo pronto",
  indexing: "Indexando",
  indexed: "Indexado",
  failed: "Falhou",
};

const READY = new Set(["chunked", "indexed"]);

export function ApostilasList({ docs }: { docs: ApostilaListItem[] }) {
  const router = useRouter();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectable = useMemo(
    () => docs.filter((d) => READY.has(d.status) && d.sourceType !== "consolidated"),
    [docs]
  );

  const selectedSubjects = useMemo(() => {
    const s = new Set<string>();
    for (const d of selectable) {
      if (selected.has(d.id) && d.subjectId) s.add(d.subjectId);
    }
    return s;
  }, [selectable, selected]);

  const anyNotReady = useMemo(() => {
    for (const d of selectable) {
      if (selected.has(d.id) && !READY.has(d.status)) return true;
    }
    return false;
  }, [selectable, selected]);

  const canConsolidate =
    selected.size >= 2 && selected.size <= 10 && selectedSubjects.size <= 1 && !anyNotReady;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function consolidate() {
    if (!canConsolidate) return;
    const ids = Array.from(selected);
    const subjectId = Array.from(selectedSubjects)[0];
    if (!subjectId) {
      setError("As apostilas selecionadas não têm matéria vinculada.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/documents/consolidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_ids: ids, subject_id: subjectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha na consolidação.");
        return;
      }
      setMessage(
        `Resumo consolidado criado: "${data?.document?.title ?? "Consolidado"}" (status: ${
          data?.document?.status ?? "processing"
        }).`
      );
      setSelected(new Set());
      setSelectMode(false);
      router.refresh();
    } catch {
      setError("Erro de rede ao consolidar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={selectMode ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setSelectMode((m) => !m);
            setSelected(new Set());
            setError(null);
            setMessage(null);
          }}
        >
          {selectMode ? "Cancelar seleção" : "Selecionar várias"}
        </Button>
        {selectMode && (
          <>
            <span className="text-xs text-slate-400">
              {selected.size} selecionada(s) ·{" "}
              {selectedSubjects.size > 1
                ? "⚠️ matérias diferentes"
                : selectedSubjects.size === 1
                  ? "matéria: " + selectable.find((d) => d.subjectId === Array.from(selectedSubjects)[0])?.subjectName
                  : "sem matéria"}
            </span>
            <Button
              size="sm"
              disabled={!canConsolidate || busy}
              onClick={consolidate}
            >
              {busy ? "Gerando resumo..." : "Consolidar em um resumo"}
            </Button>
          </>
        )}
      </div>

      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((d) => {
          const ready = READY.has(d.status);
          const isConsolidated = d.sourceType === "consolidated";
          const card = (
            <div
              className={`rounded-2xl border bg-white/5 p-4 ${
                selectMode && ready && !isConsolidated
                  ? "cursor-pointer border-cyan-400/40"
                  : "border-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase text-slate-300">
                  {d.type}
                </span>
                {isConsolidated && (
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] uppercase text-violet-300">
                    Consolidado
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    ready
                      ? "bg-emerald-500/15 text-emerald-300"
                      : d.status === "failed"
                        ? "bg-rose-500/15 text-rose-300"
                        : "bg-sky-500/15 text-sky-300"
                  }`}
                >
                  {statusLabel[d.status] ?? d.status}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-white">{d.title}</h3>
              <p className="mt-1 text-xs text-slate-400">
                {d.subjectName ? `Matéria: ${d.subjectName} · ` : ""}
                {d.pageCount ? `${d.pageCount} páginas · ` : ""}
                {d.chunkCount} trechos
              </p>
            </div>
          );

          if (selectMode && ready && !isConsolidated) {
            return (
              <button
                key={d.id}
                onClick={() => toggle(d.id)}
                className="text-left"
                aria-pressed={selected.has(d.id)}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(d.id)}
                    readOnly
                    className="mt-5 h-4 w-4 accent-cyan-400"
                  />
                  {card}
                </div>
              </button>
            );
          }
          return (
            <Link key={d.id} href={`/apostilas/${d.id}`} className="block">
              {card}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
