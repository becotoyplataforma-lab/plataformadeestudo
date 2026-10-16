"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScopeSelect } from "@/components/admin/scope-select";

interface McpOption {
  id: string;
  label: string;
}

interface McpPayload {
  providers?: McpOption[];
}

interface Subject {
  id: string;
  name: string;
}

export function ApostilaUploadForm() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [transformar, setTransformar] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mcpProviders, setMcpProviders] = useState<McpOption[]>([]);
  const [mcpProviderId, setMcpProviderId] = useState("");
  const [positionId, setPositionId] = useState("");

  useEffect(() => {
    fetch("/api/knowledge/mcp-providers")
      .then((r) => r.json())
      .then((data: McpPayload) =>
        setMcpProviders(Array.isArray(data?.providers) ? data.providers : []),
      )
      .catch(() => setMcpProviders([]));
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
        fd.append("transformar", transformar ? "true" : "false");
        if (mcpProviderId) fd.append("mcp_provider_id", mcpProviderId);
        // Escopo de compartilhamento: a rota valida o cargo e herda o edital.
        if (positionId) fd.append("position_id", positionId);
        const res = await fetch("/api/knowledge/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.message ?? data?.error ?? "Falha no upload.");
          return;
        }
        setMessage(
          transformar
            ? `Apostila enviada, processada e transformada no layout em fases (status: ${data?.document?.status ?? "?"}).`
            : `Apostila enviada e processada (status: ${data?.document?.status ?? "?"}).`
        );
        setFile(null);
        router.refresh();
      } catch {
        setError("Erro de rede ao enviar.");
      } finally {
        setBusy(false);
      }
    },
    [file, subjectId, transformar, mcpProviderId, positionId, router]
  );

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle className="text-sm text-slate-200">Enviar apostila</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            type="file"
            accept=".pdf,.docx,.txt,.md,.html"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="bg-slate-900 text-slate-200"
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
          <select
            value={mcpProviderId}
            onChange={(ev) => setMcpProviderId(ev.target.value)}
            aria-label="MCP de processamento"
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">MCP de processamento: padrao do sistema</option>
            {mcpProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
          <ScopeSelect
            positionId={positionId}
            onPositionChange={setPositionId}
          />
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={transformar}
              onChange={(e) => setTransformar(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-cyan-500"
            />
            <span>
              Transformar com IA — <strong>layout em fases</strong> + marca DeepSeek
              <span className="block text-xs text-slate-500">
                A IA reorganiza o conteúdo em fases de estudo, mantendo todo o texto técnico.
              </span>
            </span>
          </label>
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
