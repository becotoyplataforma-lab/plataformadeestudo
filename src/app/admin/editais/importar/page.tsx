import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { db } from "@/lib/db/drizzle";
import { contests } from "@/db/schema/contest";
import { isNull } from "drizzle-orm";
import { EditalImport } from "@/components/admin/edital-import";

export const dynamic = "force-dynamic";

export default async function AdminEditalImportarPage() {
  const docs = await DocumentRepository.listAll(100);
  const contestList = await db
    .select({ id: contests.id, title: contests.title })
    .from(contests)
    .where(isNull(contests.deletedAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Importar edital (IA)</h2>
        <p className="text-sm text-slate-400">
          Envie o PDF do edital em Apostilas, processe e use aqui para extrair matérias/pesos
          automaticamente e aplicar no edital vigente.
        </p>
      </div>
      <EditalImport
        documents={docs.map((d) => ({ id: d.id, title: d.title, status: d.status }))}
        contests={contestList}
      />
    </div>
  );
}
