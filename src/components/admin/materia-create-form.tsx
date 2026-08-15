"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MateriaCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("");
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
      const res = await fetch("/api/admin/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, color: color.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha ao criar matéria.");
        return;
      }
      setMsg(`Matéria "${data.name}" criada.`);
      setName("");
      setDescription("");
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
        <CardTitle className="text-sm text-slate-200">Cadastrar matéria</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3">
          <Input
            placeholder="Nome da matéria (ex.: Língua Portuguesa)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-900 text-slate-200"
          />
          <Input
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-slate-900 text-slate-200"
          />
          <div className="flex gap-2">
            <input
              type="color"
              value={color || "#06b6d4"}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-10 cursor-pointer rounded-lg border border-white/10 bg-slate-900"
            />
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Criando..." : "Criar"}
            </Button>
          </div>
          {msg && <p className="text-sm text-emerald-300 sm:col-span-3">{msg}</p>}
          {error && <p className="text-sm text-rose-300 sm:col-span-3">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
