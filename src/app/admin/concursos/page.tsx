import { isNull, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { contests, editais, positions, noticeSubjects } from "@/db/schema/contest";

export const dynamic = "force-dynamic";

export default async function AdminConcursosPage() {
  const [contestList, editalList, positionList, noticeList] = await Promise.all([
    db.select().from(contests).where(isNull(contests.deletedAt)).orderBy(desc(contests.createdAt)).limit(50),
    db.select().from(editais).where(isNull(editais.deletedAt)).orderBy(desc(editais.createdAt)).limit(100),
    db.select().from(positions).where(isNull(positions.deletedAt)).orderBy(asc(positions.name)).limit(100),
    db.select().from(noticeSubjects).where(isNull(noticeSubjects.deletedAt)).limit(200),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Concursos, editais e cargos</h2>
        <p className="text-sm text-slate-400">Estruturas existentes no banco (leitura).</p>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Concursos ({contestList.length})</h3>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {contestList.map((c) => (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-slate-200">{c.title}</td>
                  <td className="px-4 py-3 text-slate-400">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
