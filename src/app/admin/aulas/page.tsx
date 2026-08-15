import { LessonRepository } from "@/lib/study/repositories/lesson.repository";
import { LessonGenerateForm } from "@/components/admin/lesson-generate-form";

export const dynamic = "force-dynamic";

export default async function AdminAulasPage() {
  const lessons = await LessonRepository.listAll(200);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Aulas</h2>
        <p className="text-sm text-slate-400">Aulas geradas a partir das apostilas.</p>
      </div>

      <LessonGenerateForm />

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Capítulo</th>
              <th className="px-4 py-3">Duração</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {lessons.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Nenhuma aula gerada.
                </td>
              </tr>
            )}
            {lessons.map((l) => (
              <tr key={l.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-slate-200">{l.title}</td>
                <td className="px-4 py-3 text-slate-400">{l.chapter ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{l.duracaoMin ?? "—"} min</td>
                <td className="px-4 py-3 text-slate-400">{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
