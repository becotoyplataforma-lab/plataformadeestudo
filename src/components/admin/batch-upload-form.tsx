"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Subject {
  id: string;
  name: string;
}
interface FileResult {
  fileName: string;
  documentId?: string;
  status: string;
  error?: string;
  code?: string;
}

export function BatchUploadForm() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<FileResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/subjects")
      .then((r) => r.json())
      .then((data) => setSubjects(Array.isArray(data) ? data : []))
      .catch(() => setSubjects([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0 || !subjectId) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const fd = new FormData();
      fd.append("subject_id", subjectId);
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/admin/apostilas/batch", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha no upload em lote.");
        return;
      }
      setResults(Array.isArray(data?.results) ? data.results : []);
      setFiles([]);
      router.refresh();
    } catch {
      setError("Erro de rede ao enviar o lote.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle className="text-sm text-slate-200">
          Upload em lote <span className="text-rose-300">*</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.html"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="bg-slate-900 text-slate-200"
          />
          <select
            required
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">Matéria (obrigatória)</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={busy || files.length === 0 || !subjectId}>
            {busy
              ? "Enviando e processando..."
              : `Enviar ${files.length > 0 ? `${files.length} arquivo(s)` : ""}`}
          </Button>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          {results && results.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm">
              <p className="mb-2 text-emerald-300">
                {results.filter((r) => r.status !== "failed").length} ok ·{" "}
                {results.filter((r) => r.status === "failed").length} falha(s)
              </p>
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {results.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span
                      className={`mt-0.5 rounded-full px-2 py-0.5 ${
                        r.status === "failed"
                          ? "bg-rose-500/15 text-rose-300"
                          : "bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      {r.status}
                    </span>
                    <span className="text-slate-200">{r.fileName}</span>
                    {r.error && <span className="text-rose-300">{r.error}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
