import { QuestoesImportForm } from "@/components/admin/questoes-import-form";

export const dynamic = "force-dynamic";

export default async function AdminQuestoesImportarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Importar questões prontas</h2>
        <p className="text-sm text-slate-400">
          Traga provas anteriores / bancos de questões (CSV, XLSX ou JSON) com validação de
          formato antes de gravar. As questões entram em <b>em_revisão</b> — aprove na fila de
          revisão de questões antes de publicar.
        </p>
      </div>
      <QuestoesImportForm />
    </div>
  );
}
