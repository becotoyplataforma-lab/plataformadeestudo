"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EditalSubject {
  subjectId: string;
  subjectName: string;
  weight: number;
}

export function GerarQuestoes({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [subjects, setSubjects] = useState<EditalSubject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [quantity, setQuantity] = useState(5);
  const [nivel, setNivel] = useState("medio");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/study/edital-subjects")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.data)) {
          setSubjects(data.data);
          if (data.data.length === 0 && data.message) setHint(data.message);
        }
      })
      .catch(() => setHint("Não foi possível carregar as matérias do edital."));
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!subjectId) return;
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const res = await fetch("/api/questions/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_id: documentId, subject_id: subjectId, quantity, nivel }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.message ?? data?.error ?? "Falha na geração.");
          return;
        }
        setMessage(
          `${data.generated} questão(ões) gerada(s) para revisão${
            data.rejected ? ` · ${data.rejected} descartada(s) pela validação` : ""
          }.`
        );
        router.refresh();
      } catch {
        setError("Erro de rede ao gerar questões.");
      } finally {
        setBusy(false);
      }
    },
    [documentId, subjectId, quantity, nivel, router]
  );

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle className="text-sm text-slate-200">Gerar questões desta apostila</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            required
          >
            <option value="">Matéria do edital</option>
            {subjects.map((s) => (
              <option key={s.subjectId} value={s.subjectId}>
                {s.subjectName} (peso {s.weight}%)
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
            title="Quantidade de questões"
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
          <Button type="submit" disabled={busy || !subjectId}>
            {busy ? "Gerando..." : "Gerar questões"}
          </Button>
          {hint && <p className="text-xs text-slate-500 sm:col-span-2">{hint}</p>}
          {message && <p className="text-sm text-emerald-300 sm:col-span-2">{message}</p>}
          {error && <p className="text-sm text-rose-300 sm:col-span-2">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
