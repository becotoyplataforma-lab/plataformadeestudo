import { db } from "@/lib/db/drizzle";
import { aiUsage } from "@/db/schema/ai";
import { sql } from "drizzle-orm";
import { KimiService } from "@/lib/ai/kimi";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminIaPage() {
  const deepseek = Boolean(process.env.DEEPSEEK_API_KEY);
  const embedding = Boolean(process.env.EMBEDDING_API_URL);
  const kimiConfigured = KimiService.isConfigured();
  let kimiModels: string[] = [];
  let kimiError: string | null = null;

  if (kimiConfigured) {
    try {
      kimiModels = await KimiService.listModels();
    } catch {
      kimiError = "Não foi possível consultar os modelos Kimi.";
    }
  }

  const [usage] = await db
    .select({
      messages: sql<number>`coalesce(sum(${aiUsage.messagesCount}), 0)::int`,
      tokensIn: sql<number>`coalesce(sum(${aiUsage.tokensIn}), 0)::int`,
      tokensOut: sql<number>`coalesce(sum(${aiUsage.tokensOut}), 0)::int`,
    })
    .from(aiUsage);

  const items = [
    { label: "DeepSeek (geração de texto)", ok: deepseek, hint: "DEEPSEEK_API_KEY" },
    { label: "Kimi / Moonshot", ok: kimiConfigured && !kimiError, hint: "KIMI_API_KEY" },
    { label: "Embeddings (busca vetorial)", ok: embedding, hint: "EMBEDDING_API_URL" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">IA</h2>
        <p className="text-sm text-slate-400">Status da infraestrutura de IA (não exibe segredos).</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-200">{item.label}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  item.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                }`}
              >
                {item.ok ? "configurado" : "não configurado"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-200">Modelos Kimi disponíveis</p>
          <span className="text-xs text-slate-500">{env.KIMI_BASE_URL ?? "https://api.moonshot.ai/v1"}</span>
        </div>
        {kimiError ? (
          <p className="mt-3 text-sm text-rose-300">{kimiError}</p>
        ) : kimiModels.length > 0 ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {kimiModels.map((model) => (
              <li key={model} className="rounded-lg border border-white/10 px-3 py-2 font-mono text-xs text-slate-300">
                {model}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            {kimiConfigured ? "A API não retornou modelos." : "Configure KIMI_API_KEY para carregar os modelos."}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-medium text-slate-200">Uso acumulado</p>
        <div className="mt-2 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-white">{usage?.messages ?? 0}</p>
            <p className="text-xs text-slate-400">mensagens</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{usage?.tokensIn ?? 0}</p>
            <p className="text-xs text-slate-400">tokens entrada</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{usage?.tokensOut ?? 0}</p>
            <p className="text-xs text-slate-400">tokens saída</p>
          </div>
        </div>
      </div>
    </div>
  );
}
