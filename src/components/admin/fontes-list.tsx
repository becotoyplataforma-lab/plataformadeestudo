"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Fonte {
  id: string;
  title: string;
  type: string;
  status: string;
  reviewStatus: string;
  sourceType: string;
  sourceUrl: string | null;
  fonte: string | null;
  licenca: string | null;
  createdAt: string;
}

export function FontesList({ fontes }: { fontes: Fonte[] }) {
  const router = useRouter();
  const [fonte, setFonte] = useState<Record<string, string>>({});
  const [licenca, setLicenca] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(id: string, f: Fonte) {
    setSavingId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/documents/${id}/fonte`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fonte: fonte[id] ?? f.fonte ?? undefined,
          licenca: licenca[id] ?? f.licenca ?? undefined,
        }),
      });
      if (res.ok) setMessage("Fonte/licença atualizada.");
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {message && <p className="text-sm text-emerald-300">{message}</p>}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Material</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">Fonte</th>
              <th className="px-4 py-3">Licença</th>
              <th className="px-4 py-3">Importado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {fontes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Nenhum material com origem registrada.
                </td>
              </tr>
            )}
            {fontes.map((f) => (
              <tr key={f.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-slate-200">{f.title}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">
                    {f.sourceType}
                  </span>
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                      f.reviewStatus === "aprovado"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : f.reviewStatus === "rejeitado"
                          ? "bg-rose-500/15 text-rose-300"
                          : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {f.reviewStatus}
                  </span>
                </td>
                <td className="max-w-[220px] truncate px-4 py-3 text-slate-400">
                  {f.sourceUrl ? (
                    <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">
                      {f.sourceUrl}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <input
                    value={fonte[f.id] ?? f.fonte ?? ""}
                    onChange={(e) => setFonte((s) => ({ ...s, [f.id]: e.target.value }))}
                    placeholder="ex.: Diário Oficial, Planalto"
                    className="w-36 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    value={licenca[f.id] ?? f.licenca ?? ""}
                    onChange={(e) => setLicenca((s) => ({ ...s, [f.id]: e.target.value }))}
                    placeholder="ex.: domínio público"
                    className="w-32 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                  />
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {new Date(f.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={savingId === f.id}
                    onClick={() => save(f.id, f)}
                  >
                    Salvar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
