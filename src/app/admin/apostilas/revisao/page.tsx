import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { ReviewQueue } from "@/components/admin/review-queue";

export const dynamic = "force-dynamic";

export default async function AdminApostilasRevisaoPage() {
  const docs = await DocumentRepository.listForReview(100);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Fila de revisão de material</h2>
        <p className="text-sm text-slate-400">
          Confira o texto extraído (para pegar PDF escaneado, texto quebrado) e aprove/rejeite
          antes de liberar o material. Material <b>rejeitado</b> fica bloqueado na geração de
          questões.
        </p>
      </div>
      <ReviewQueue
        documents={docs.map((d) => ({
          id: d.id,
          title: d.title,
          type: d.type,
          status: d.status,
          reviewStatus: d.reviewStatus,
          reviewNote: d.reviewNote,
          chunkCount: d.chunkCount,
          pageCount: d.pageCount,
          processingError: d.processingError,
          createdAt: d.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
