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
interface ImportResult {
  imported?: number;
  skipped?: number;
  errors?: { row: number; message: string }[];
  error?: string;
  message?: string;
}

export function QuestoesImportForm() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [banca, setBanca] = useState("");
  const [cargo, setCargo] = useState("");
  const [ano, setAno] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    fetch("/api/admin/subjects")
      .then((r) => r.json())
      .then((data) => setSubjects(Array.isArray(data) ? data : []))
      .catch(() => setSubjects([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !subjectId) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("subject_id", subjectId);
      if (banca) fd.append("banca", banca);
      if (cargo) fd.append("cargo", cargo);
      if (ano) fd.append("ano", ano);
      const res = await fetch("/api/admin/questions/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data?.error, message: data?.message ?? "Falha na importação." });
        return;
      }
      setResult(data);
      setFile(null);
      router.refresh();
    } catch {
      setResult({ error: "NETWORK", message: "Erro de rede." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle className="text-sm text-slate-200">Importar questões prontas (CSV / XLSX / JSON)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 rounded-xl border border-white/10 bg-slate-900/40 p-3 text-xs text-slate-400">
          Colunas: <code>enunciado, a, b, c, d, e, gabarito</code> (obrigatórias) ·{" "}
          <code>explicacao, nivel, ano, banca, cargo, fonte, tema</code> (opcionais). Gabarito =
          letra (A–E). Questões entram em <b>em_revisão</b> e são deduplicadas por conteúdo.
          {" "}
          <a
            href="/api/admin/questions/import/template"
            className="text-cyan-300 underline"
          >
            Baixar modelo CSV
          </a>
        </div>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <Input
            type="file"
            accept=".csv,.xlsx,.xls,.json,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="bg-slate-900 text-slate-200 sm:col-span-2"
          />
          <select
            required
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 sm:col-span-2"
          >
            <option value="">Matéria (obrigatória)</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Banca padrão (opcional)"
            value={banca}
            onChange={(e) => setBanca(e.target.value)}
            className="bg-slate-900 text-slate-200"
          />
          <Input
            placeholder="Cargo padrão (opcional)"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            className="bg-slate-900 text-slate-200"
          />
          <Input
            placeholder="Ano padrão (opcional)"
            type="number"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            className="bg-slate-900 text-slate-200"
          />
          <Button type="submit" disabled={busy || !file || !subjectId}>
            {busy ? "Importando..." : "Importar questões"}
          </Button>
          {result && (
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm sm:col-span-2">
              {result.error ? (
                <p className="text-rose-300">
                  {result.error}: {result.message}
                </p>
              ) : (
                <>
                  <p className="text-emerald-300">
                    Importadas: {result.imported} · Duplicadas/ignoradas: {result.skipped} ·{" "}
                    Com erro: {result.errors?.length ?? 0}
                  </p>
                  {result.errors && result.errors.length > 0 && (
                    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-rose-300">
                      {result.errors.slice(0, 50).map((e, i) => (
                        <li key={i}>
                          Linha {e.row}: {e.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
