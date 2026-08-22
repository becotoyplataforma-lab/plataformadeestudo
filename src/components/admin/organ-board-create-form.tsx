"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OrganBoardCreateForm() {
  const router = useRouter();
  const [type, setType] = useState<"organ" | "board">("organ");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/organs-boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha ao criar.");
        return;
      }
      setMsg(`${type === "organ" ? "Órgão" : "Banca"} "${data.name}" criado.`);
      setName("");
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle className="text-sm text-slate-200">Cadastrar órgão / banca</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[auto_1fr_auto]">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "organ" | "board")}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="organ">Órgão</option>
            <option value="board">Banca</option>
          </select>
          <Input
            placeholder={type === "organ" ? "Nome do órgão (ex.: PMERJ)" : "Nome da banca (ex.: CEBRASPE)"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-900 text-slate-200"
          />
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Criando..." : "Criar"}
          </Button>
          {msg && <p className="text-sm text-emerald-300 sm:col-span-3">{msg}</p>}
          {error && <p className="text-sm text-rose-300 sm:col-span-3">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
