"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Doc {
  id: string;
  title: string;
  status: string;
}
interface Subject {
  id: string;
  name: string;
}

export function QuestaoGenerateForm({ initialDocId }: { initialDocId?: string }) {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [documentId, setDocumentId] = useState(initialDocId ?? "");
  const [subjectId, setSubjectId] = useState("");
  const [quantity, setQuantity] = useState(5);
  const [nivel, setNivel] = useState("medio");
  const [banca, setBanca] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/knowledge/documents")
      .then((r) => r.json())
      .then((data) => setDocs(Array.isArray(data) ? data.filter((d: Doc) => d.status === "chunked" || d.status === "indexed") : []))
      .catch(() => setDocs([]));
    fetch("/api/knowledge/subjects")
      .then((r) => r.json())
      .then((data) => setSubjects(Array.isArray(data) ? data : []))
      .catch(() => setSubjects([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!documentId || !subjectId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: documentId, subject_id: subjectId, quantity, nivel, banca: banca || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha na geração.");
        return;
      }
      setResult(
        `${data.generated} gerada(s), ${data.rejected} rejeitada(s). Confira em Revisão.`
      );
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
        <CardTitle className="text-sm text-slate-200">Gerar questões por IA</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <select
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            required
          >
            <option value="">Apostila (processada)</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            required
          >
            <option value="">Matéria</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          />
          <select
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="facil">Fácil</option>
            <option value="medio">Médio</option>
            <option value="dificil">Difícil</option>
          </select>
          <input
            type="text"
            placeholder="Banca (opcional)"
            value={banca}
            onChange={(e) => setBanca(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          />
          <Button type="submit" disabled={busy || !documentId || !subjectId} className="sm:col-span-2">
            {busy ? "Gerando..." : "Gerar questões"}
          </Button>
          {result && <p className="text-sm text-emerald-300 sm:col-span-2">{result}</p>}
          {error && <p className="text-sm text-rose-300 sm:col-span-2">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
