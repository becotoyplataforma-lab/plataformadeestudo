"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Subject {
  id: string;
  name: string;
}

export function ApostilaUpload() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/knowledge/subjects")
      .then((r) => r.json())
      .then((data) => setSubjects(Array.isArray(data) ? data : []))
      .catch(() => setSubjects([]));
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!file) return;
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        if (subjectId) fd.append("subject_id", subjectId);
        const res = await fetch("/api/knowledge/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.message ?? data?.error ?? "Falha no upload.");
          return;
        }
        setMessage(
          `Apostila enviada e processada (status: ${data?.document?.status ?? "?"}).`
        );
        setFile(null);
        router.refresh();
      } catch {
        setError("Erro de rede ao enviar.");
      } finally {
        setBusy(false);
      }
    },
    [file, subjectId, router]
  );

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle className="text-sm text-slate-200">Enviar apostila</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md,.html"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1 file:text-xs file:font-medium file:text-cyan-200"
          />
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">Matéria (opcional)</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={busy || !file}>
            {busy ? "Processando..." : "Enviar e processar"}
          </Button>
          {message && <p className="text-sm text-emerald-300">{message}</p>}
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
