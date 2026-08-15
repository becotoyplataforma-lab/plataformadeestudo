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
interface Avatar {
  id: string;
  nome: string;
}

export function LessonGenerateForm() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [chapter, setChapter] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
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
    fetch("/api/admin/avatares/list")
      .then((r) => r.json())
      .then((data) => setAvatars(Array.isArray(data) ? data : []))
      .catch(() => setAvatars([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!documentId || !subjectId) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/lessons/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: documentId,
          subject_id: subjectId,
          avatar_id: avatarId || undefined,
          chapter: chapter || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha na geração da aula.");
        return;
      }
      setMsg(`Aula criada: ${data.title}`);
      setChapter("");
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
        <CardTitle className="text-sm text-slate-200">Gerar aula (roteiro) por IA</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <select
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            required
          >
            <option value="">Apostila</option>
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
          <select
            value={avatarId}
            onChange={(e) => setAvatarId(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">Avatar (opcional)</option>
            {avatars.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Capítulo (opcional)"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          />
          <Button type="submit" disabled={busy || !documentId || !subjectId} className="sm:col-span-2">
            {busy ? "Gerando..." : "Gerar aula"}
          </Button>
          {msg && <p className="text-sm text-emerald-300 sm:col-span-2">{msg}</p>}
          {error && <p className="text-sm text-rose-300 sm:col-span-2">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
