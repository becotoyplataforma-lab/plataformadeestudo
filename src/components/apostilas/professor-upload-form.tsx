"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface McpProviderOption {
  id: string;
  label: string;
  version: string;
  description: string;
  capabilities: string[];
  isDefault: boolean;
}

interface McpProvidersPayload {
  defaultProviderId?: string;
  providers?: McpProviderOption[];
}

interface Subject {
  id: string;
  name: string;
}

/**
 * Formulário de upload de apostila para ADMINISTRADOR e PROFESSOR.
 * Inclui opção de transformar o conteúdo no layout em fases com a marca
 * DeepSeek (baleia) — o prompt de transformação roda no servidor.
 */
export function ProfessorUploadForm() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [mcpProviders, setMcpProviders] = useState<McpProviderOption[]>([]);
  const [mcpProviderId, setMcpProviderId] = useState("");
  const [defaultMcpId, setDefaultMcpId] = useState("");
  const selectedMcp = mcpProviders.find(function (provider) {
    return provider.id === (mcpProviderId || defaultMcpId);
  });

  const [transformar, setTransformar] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Busca matérias disponíveis para associação.
  useEffect(() => {
    fetch("/api/knowledge/subjects")
      .then((r) => r.json())
      .then((data) => setSubjects(Array.isArray(data) ? data : []))
      .catch(() => setSubjects([]));
  }, []);

  // Busca os provedores MCP disponiveis. Se a lista falhar, o upload segue com o
  // comportamento padrao do servidor: a tela nunca bloqueia o envio.
  useEffect(() => {
    fetch("/api/knowledge/mcp-providers")
      .then(function (response) { return response.json(); })
      .then(function (data: McpProvidersPayload) {
        setMcpProviders(Array.isArray(data?.providers) ? data.providers : []);
        setDefaultMcpId(typeof data?.defaultProviderId === "string" ? data.defaultProviderId : "");
      })
      .catch(function () { setMcpProviders([]); });
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
        if (mcpProviderId) fd.append("mcp_provider_id", mcpProviderId);
        fd.append("transformar", transformar ? "true" : "false");
        const res = await fetch("/api/knowledge/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.message ?? data?.error ?? "Falha no upload.");
          return;
        }
        setMessage(
          transformar
            ? `Apostila enviada e transformada no layout em fases (status: ${data?.document?.status ?? "?"}).`
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
    [file, subjectId, transformar, mcpProviderId, router]
  );

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle className="text-sm text-slate-200">
          Enviar apostila — Professores e Administradores
        </CardTitle>
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
            onChange={(e) => setMcpProviderId(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">MCP padrao do sistema</option>
            {mcpProviders.map(function (provider) {
              return (
                <option key={provider.id} value={provider.id}
                  disabled={!provider.capabilities.includes("ingest")}>
                  {provider.label} ({provider.version})
                </option>
              );
            })}
          </select>
          {selectedMcp ? (
            <p className="text-xs text-slate-500">
              Capacidades: {selectedMcp.capabilities.join(", ")}
              {selectedMcp.isDefault ? " - padrao do sistema" : null}
            </p>
          ) : null}

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
                A IA reorganiza o conteúdo em fases de estudo, mantendo todo o texto técnico e
                adicionando caixas de REGRA, ATENÇÃO, DICA e CUIDADO.
              </span>
            </span>
          </label>
          <Button type="submit" disabled={busy || !file}>
            {busy ? "Processando..." : "Enviar e transformar"}
          </Button>
          {message && <p className="text-sm text-emerald-300">{message}</p>}
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
