import { QuestaoGenerateForm } from "@/components/admin/questao-generate-form";

export const dynamic = "force-dynamic";

export default async function AdminGerarQuestoesPage({
  searchParams,
}: {
  searchParams: Promise<{ document_id?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Gerar questões</h2>
        <p className="text-sm text-slate-400">
          As questões são geradas como <span className="text-amber-300">EM REVISÃO</span> — nunca
          publicadas automaticamente. Requer DEEPSEEK_API_KEY configurada.
        </p>
      </div>
      <QuestaoGenerateForm initialDocId={sp.document_id} />
    </div>
  );
}
