"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Star, Calendar } from "lucide-react";

export interface ApostilaListItem {
  id: string;
  title: string;
  type: string;
  status: string;
  chunkCount: number;
  pageCount: number | null;
  sourceType: string;
  reviewStatus: string;
  isFavorite?: boolean;
  createdAt?: string;
  subjectId?: string;
  subjectName?: string;
  subjectColor?: string | null;
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

/** Progresso real do pipeline: cada estágio vale uma fatia (0–100). */
const STATUS_PROGRESS: Record<string, number> = {
  pending: 5,
  processing: 25,
  processed: 50,
  chunked: 75,
  indexing: 90,
  indexed: 100,
  failed: 10,
};

/** Cor da barra de progresso por estado real. */
function progressBarClass(status: string): string {
  if (READY.has(status)) return "bg-emerald-400";
  if (status === "failed") return "bg-rose-400";
  if (status === "processing" || status === "indexing") return "bg-sky-400";
  return "bg-slate-400";
}

function formatDate(iso?: string): string {
  if (!iso) return "Data indisponível";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Data indisponível";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ApostilasList({ docs }: { docs: ApostilaListItem[] }) {
  const router = useRouter();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(docs.filter((d) => d.isFavorite).map((d) => d.id))
  );
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todas" | "favoritas" | "prontas">("todas");
  const [subjectFilter, setSubjectFilter] = useState<string>("todas");

  const selectable = useMemo(
    () => docs.filter((d) => READY.has(d.status) && d.sourceType !== "consolidated"),
    [docs]
  );

  const subjects = useMemo(() => {
    const byName = new Map<string, { id: string; color: string | null }>();
    for (const d of docs) {
      if (d.subjectId && d.subjectName && !byName.has(d.subjectName)) {
        byName.set(d.subjectName, { id: d.subjectId, color: d.subjectColor ?? null });
      }
    }
    return Array.from(byName.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [docs]);

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (filter === "favoritas" && !favorites.has(d.id)) return false;
      if (filter === "prontas" && !READY.has(d.status)) return false;
      if (subjectFilter !== "todas" && d.subjectId !== subjectFilter) return false;
      return true;
    });
  }, [docs, filter, subjectFilter, favorites]);

  const favoriteCount = favorites.size;
  const readyCount = docs.filter((d) => READY.has(d.status)).length;

  async function toggleFavorite(id: string) {
    if (favoriteBusyId) return;
    const next = !favorites.has(id);
    setFavoriteBusyId(id);
    setError(null);
    // Otimista — reverte em caso de erro.
    setFavorites((prev) => {
      const s = new Set(prev);
      if (next) s.add(id);
      else s.delete(id);
      return s;
    });
    try {
      const res = await fetch(`/api/knowledge/documents/${id}/favorite`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? data?.error ?? "Falha ao favoritar.");
      }
    } catch (e) {
      setFavorites((prev) => {
        const s = new Set(prev);
        if (next) s.delete(id);
        else s.add(id);
        return s;
      });
      setError(e instanceof Error ? e.message : "Erro de rede ao favoritar.");
    } finally {
      setFavoriteBusyId(null);
    }
  }

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
    <div className="space-y-6">
      {/* ===== Barra de filtros (padrão "Meus Cursos") ===== */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
          {(
            [
              ["todas", `Todas (${docs.length})`],
              ["favoritas", `Favoritas (${favoriteCount})`],
              ["prontas", `Prontas (${readyCount})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                filter === key
                  ? "bg-[#4D6BFE] text-white shadow"
                  : "text-slate-300 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {subjects.length > 0 && (
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 outline-none transition focus:border-[#4D6BFE]/50"
            aria-label="Filtrar por matéria"
          >
            <option value="todas">Todas as matérias</option>
            {subjects.map(([name, s]) => (
              <option key={s.id} value={s.id}>
                {name}
              </option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-3">
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
                    ? "matéria: " +
                      selectable.find((d) => d.subjectId === Array.from(selectedSubjects)[0])
                        ?.subjectName
                    : "sem matéria"}
              </span>
              <Button size="sm" disabled={!canConsolidate || busy} onClick={consolidate}>
                {busy ? "Gerando resumo..." : "Consolidar em um resumo"}
              </Button>
            </>
          )}
        </div>
      </div>

      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {/* ===== Grade de cards (3 colunas, padrão "Meus Cursos") ===== */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-slate-300">
            {filter === "favoritas"
              ? "Nenhuma apostila favorita ainda. Toque na estrela para favoritar."
              : filter === "prontas"
                ? "Nenhuma apostila pronta para estudar."
                : "Nenhuma apostila nesta matéria."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const ready = READY.has(d.status);
            const isConsolidated = d.sourceType === "consolidated";
            const progress = STATUS_PROGRESS[d.status] ?? 5;
            const isFav = favorites.has(d.id);
            const barClass = progressBarClass(d.status);

            const favoriteButton = (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFavorite(d.id);
                }}
                disabled={favoriteBusyId === d.id}
                aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                aria-pressed={isFav}
                title={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                className={`rounded-xl p-2 transition ${
                  isFav
                    ? "text-amber-300 hover:bg-amber-400/10"
                    : "text-slate-500 hover:bg-white/10 hover:text-slate-300"
                } ${favoriteBusyId === d.id ? "cursor-wait opacity-50" : ""}`}
              >
                <Star className="h-4 w-4" fill={isFav ? "currentColor" : "none"} />
              </button>
            );

            const card = (
              <div
                className={`group relative flex h-full flex-col rounded-2xl border bg-white/5 p-5 transition hover:border-[#4D6BFE]/40 hover:bg-white/[0.07] hover:shadow-[0_20px_50px_rgba(2,6,23,0.45)] ${
                  selectMode && ready && !isConsolidated
                    ? "cursor-pointer border-cyan-400/40"
                    : "border-white/10"
                }`}
              >
                {/* Topo: etiqueta da matéria (cor real) + favorito */}
                <div className="flex items-start justify-between gap-2">
                  {d.subjectName && d.subjectColor ? (
                    <span
                      className="inline-flex max-w-[70%] items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        color: d.subjectColor,
                        backgroundColor: `${d.subjectColor}1a`,
                        border: `1px solid ${d.subjectColor}40`,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: d.subjectColor }}
                      />
                      {d.subjectName}
                    </span>
                  ) : d.subjectName ? (
                    <span className="inline-flex max-w-[70%] items-center rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                      {d.subjectName}
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {d.type}
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    {isConsolidated && (
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] uppercase text-violet-300">
                        Consolidado
                      </span>
                    )}
                    {favoriteButton}
                  </div>
                </div>

                {/* Título em negrito */}
                <h3 className="mt-3 line-clamp-2 text-base font-bold leading-snug text-white">
                  {d.title}
                </h3>

                {/* Status */}
                <span
                  className={`mt-2 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    ready
                      ? "bg-emerald-500/15 text-emerald-300"
                      : d.status === "failed"
                        ? "bg-rose-500/15 text-rose-300"
                        : "bg-sky-500/15 text-sky-300"
                  }`}
                >
                  {statusLabel[d.status] ?? d.status}
                </span>

                {/* Datas de disponibilidade (real: upload) */}
                <p className="mt-3 text-xs text-slate-400">
                  {d.pageCount ? `${d.pageCount} páginas · ` : ""}
                  {d.chunkCount} trechos
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Disponível em {formatDate(d.createdAt)}
                </p>

                <div className="mt-auto pt-4">
                  {/* Barra de progresso real (estágio do pipeline) */}
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <span>{progress === 100 ? "Pronto para estudar" : "Em preparação"}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Rodapé: calendário → cronograma */}
                  <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                    <span className="text-xs text-slate-400">
                      {ready ? "Abrir e estudar" : "Processando conteúdo"}
                    </span>
                    <Link
                      href="/cronograma"
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                      title="Ver no cronograma"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Cronograma
                    </Link>
                  </div>
                </div>
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
      )}
    </div>
  );
}
