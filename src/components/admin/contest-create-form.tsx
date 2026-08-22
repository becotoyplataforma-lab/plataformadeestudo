"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Organ {
  id: string;
  name: string;
}
interface Board {
  id: string;
  name: string;
}
interface OrgansBoards {
  organs: Organ[];
  boards: Board[];
}

const STATUS_OPTIONS = [
  { value: "rascunho", label: "Rascunho" },
  { value: "publicado", label: "Publicado" },
  { value: "encerrado", label: "Encerrado" },
  { value: "arquivado", label: "Arquivado" },
] as const;

export function ContestCreateForm() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<OrgansBoards | null>(null);
  const [organId, setOrganId] = useState("");
  const [boardId, setBoardId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("rascunho");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/organs-boards")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setCatalog(data);
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !organId || !boardId) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/contests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organ_id: organId,
          board_id: boardId,
          title: title.trim(),
          description: description.trim() || undefined,
          status: status || undefined,
          start_date: startDate || null,
          end_date: endDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha ao criar concurso.");
        return;
      }
      setMsg(`Concurso "${data.title}" criado (${data.status}).`);
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  if (!catalog) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardContent className="py-4 text-sm text-slate-400">Carregando órgãos e bancas...</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle className="text-sm text-slate-200">Cadastrar concurso</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={organId}
              onChange={(e) => setOrganId(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            >
              <option value="">Órgão...</option>
              {catalog.organs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            >
              <option value="">Banca...</option>
              {catalog.boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            placeholder="Título (ex.: Concurso PMERJ 2026)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-slate-900 text-slate-200"
          />
          <Textarea
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-slate-900 text-slate-200"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-900 text-slate-200"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-900 text-slate-200"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !title.trim() || !organId || !boardId}>
              {busy ? "Criando..." : "Criar concurso"}
            </Button>
          </div>
          {msg && <p className="text-sm text-emerald-300">{msg}</p>}
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
