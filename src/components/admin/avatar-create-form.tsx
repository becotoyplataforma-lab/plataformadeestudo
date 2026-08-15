"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AvatarCreateForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [personalidade, setPersonalidade] = useState("");
  const [voz, setVoz] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome || !slug) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/avatares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, slug, personalidade, voz }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha ao criar avatar.");
        return;
      }
      setMsg("Avatar criado.");
      setNome("");
      setSlug("");
      setPersonalidade("");
      setVoz("");
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
        <CardTitle className="text-sm text-slate-200">Criar avatar</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="bg-slate-900 text-slate-200"
          />
          <Input
            placeholder="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="bg-slate-900 text-slate-200"
          />
          <Input
            placeholder="Personalidade"
            value={personalidade}
            onChange={(e) => setPersonalidade(e.target.value)}
            className="bg-slate-900 text-slate-200"
          />
          <Input
            placeholder="Voz"
            value={voz}
            onChange={(e) => setVoz(e.target.value)}
            className="bg-slate-900 text-slate-200"
          />
          <Button type="submit" disabled={busy || !nome || !slug} className="sm:col-span-2">
            {busy ? "Criando..." : "Criar"}
          </Button>
          {msg && <p className="text-sm text-emerald-300 sm:col-span-2">{msg}</p>}
          {error && <p className="text-sm text-rose-300 sm:col-span-2">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
