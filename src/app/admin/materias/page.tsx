import { KnowledgeSubjectRepository } from "@/lib/knowledge/repositories/subject.repository";
import { MateriaCreateForm } from "@/components/admin/materia-create-form";

export const dynamic = "force-dynamic";

export default async function AdminMateriasPage() {
  const subjects = await KnowledgeSubjectRepository.getAll();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Matérias</h2>
        <p className="text-sm text-slate-400">
          Catálogo geral de matérias — reaproveitado entre concursos e vinculado ao edital.
        </p>
      </div>

      <MateriaCreateForm />

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Cor</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-slate-200">{s.name}</td>
                <td className="px-4 py-3 text-slate-400">{s.slug}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-block h-4 w-4 rounded-full"
                    style={{ backgroundColor: s.color ?? "#334155" }}
                  />
                </td>
                <td className="px-4 py-3 text-slate-400">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
