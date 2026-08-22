import { isNull, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { contests, editais, positions, noticeSubjects } from "@/db/schema/contest";
import { ContestCreateForm } from "@/components/admin/contest-create-form";
import { OrganBoardCreateForm } from "@/components/admin/organ-board-create-form";
import { ContestManager } from "@/components/admin/contest-manager";

export const dynamic = "force-dynamic";

export default async function AdminConcursosPage() {
  const [contestList, editalList, positionList, noticeList] = await Promise.all([
    db.select().from(contests).where(isNull(contests.deletedAt)).orderBy(desc(contests.createdAt)).limit(50),
    db.select().from(editais).where(isNull(editais.deletedAt)).orderBy(desc(editais.createdAt)).limit(100),
    db.select().from(positions).where(isNull(positions.deletedAt)).orderBy(asc(positions.name)).limit(100),
    db.select().from(noticeSubjects).where(isNull(noticeSubjects.deletedAt)).limit(200),
  ]);

  const contestRows = contestList.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    status: c.status,
    organId: c.organId,
    boardId: c.boardId,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Concursos, editais e cargos</h2>
        <p className="text-sm text-slate-400">Crie e gerencie a estrutura de concursos.</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <ContestCreateForm />
          <OrganBoardCreateForm />
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-300">Concursos ({contestList.length})</h3>
          <ContestManager initial={contestRows} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Editais ({editalList.length})</h3>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Vigente</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {editalList.map((e) => (
                <tr key={e.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-slate-200">{e.title}</td>
                  <td className="px-4 py-3 text-slate-400">{e.isCurrent ? "sim" : "não"}</td>
                  <td className="px-4 py-3 text-slate-400">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">
          Cargos ({positionList.length}) · Matérias do edital ({noticeList.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {positionList.map((p) => (
            <span key={p.id} className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
              {p.name}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
