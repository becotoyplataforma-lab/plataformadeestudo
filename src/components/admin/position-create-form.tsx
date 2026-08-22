"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PositionCreateForm({ contestId }: { contestId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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
      const res = await fetch("/api/admin/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contest_id: contestId,
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha ao criar cargo.");
        return;
      }
      setMsg(`Cargo "${data.name}" criado.`);
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
        <CardTitle className="text-sm text-slate-200">Cadastrar cargo</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3">
          <Input
            placeholder="Nome do cargo (ex.: Soldado PM)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-900 text-slate-200"
          />
          <Textarea
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-slate-900 text-slate-200"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Criando..." : "Criar cargo"}
            </Button>
          </div>
          {msg && <p className="text-sm text-emerald-300">{msg}</p>}
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
