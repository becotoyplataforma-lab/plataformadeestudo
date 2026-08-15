import Link from "next/link";
import { ModerationRepository } from "@/lib/administration/repositories/moderation.repository";

export const dynamic = "force-dynamic";

export default async function AdminQuestoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; subject_id?: string; banca?: string }>;
}) {
  const sp = await searchParams;
  const result = await ModerationRepository.listQuestions({
    status: sp.status as never,
    subjectId: sp.subject_id,
    banca: sp.banca,
    page: 1,
    pageSize: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Questões</h2>
          <p className="text-sm text-slate-400">{result.total} questão(ões) no banco.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/questoes/gerar"
            className="rounded-xl bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-200 ring-1 ring-inset ring-cyan-400/30 hover:bg-cyan-500/25"
          >
            Gerar
          </Link>
          <Link
            href="/admin/questoes/revisao"
            className="rounded-xl bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-200 ring-1 ring-inset ring-amber-400/30 hover:bg-amber-500/25"
          >
            Revisão
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Matéria</th>
              <th className="px-4 py-3">Banca</th>
              <th className="px-4 py-3">Nível</th>
              <th className="px-4 py-3">Enunciado</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhuma questão encontrada.
                </td>
              </tr>
            )}
            {result.data.map((q) => (
              <tr key={q.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-slate-200">{q.subjectName ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{q.banca ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{q.nivel}</td>
                <td className="max-w-md px-4 py-3 text-slate-300">
                  {q.enunciado.slice(0, 160)}
                  {q.enunciado.length > 160 ? "…" : ""}
                </td>
                <td className="px-4 py-3 text-slate-400">{q.origin ?? "manual"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                    {q.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
