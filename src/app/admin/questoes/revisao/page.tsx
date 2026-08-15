import { QuestaoReviewQueue } from "@/components/admin/questao-review-queue";

export const dynamic = "force-dynamic";

export default async function AdminRevisaoPage({
  searchParams,
}: {
  searchParams: Promise<{ document_id?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Revisão de questões</h2>
        <p className="text-sm text-slate-400">
          Aprove, rejeite ou bloqueie questões geradas por IA.
        </p>
      </div>
      <QuestaoReviewQueue documentId={sp.document_id} />
    </div>
  );
}
