import { db } from "@/lib/db/drizzle";
import { editais, contests } from "@/db/schema/contest";
import { eq, isNull } from "drizzle-orm";
import { ContestIntelligenceClient } from "@/components/admin/contest-intelligence-client";

export const dynamic = "force-dynamic";

export default async function AdminContestIntelligencePage() {
  const rows = await db
    .select({
      id: editais.id,
      title: editais.title,
      contestTitle: contests.title,
    })
    .from(editais)
    .innerJoin(contests, eq(editais.contestId, contests.id))
    .where(isNull(editais.deletedAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Contest Intelligence</h2>
        <p className="text-sm text-slate-400">
          Análise de banca/edital (v1): distribuição de peso por matéria e padrão histórico da
          banca. Só exibe dados que existem no banco — sem estimativas inventadas.
        </p>
      </div>
      <ContestIntelligenceClient editais={rows} />
    </div>
  );
}
