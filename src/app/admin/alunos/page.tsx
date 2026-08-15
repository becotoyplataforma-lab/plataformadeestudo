import { eq, desc, count } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { authUsers, profiles } from "@/db/schema/identity";
import { questionAttempts } from "@/db/schema/study";

export const dynamic = "force-dynamic";

export default async function AdminAlunosPage() {
  const users = await db
    .select({
      id: authUsers.id,
      email: authUsers.email,
      level: profiles.level,
      contestId: profiles.contestId,
      createdAt: profiles.createdAt,
    })
    .from(authUsers)
    .leftJoin(profiles, eq(authUsers.id, profiles.id))
    .orderBy(desc(profiles.createdAt))
    .limit(200);

  const attempts = await db
    .select({
      userId: questionAttempts.userId,
      total: count(questionAttempts.id),
    })
    .from(questionAttempts)
    .groupBy(questionAttempts.userId);

  const attemptsByUser = new Map(attempts.map((a) => [a.userId, a.total]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Alunos</h2>
        <p className="text-sm text-slate-400">{users.length} usuário(s) registrados.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Nível</th>
              <th className="px-4 py-3">Questões respondidas</th>
              <th className="px-4 py-3">Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-slate-200">{u.email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{u.level ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{attemptsByUser.get(u.id) ?? 0}</td>
                <td className="px-4 py-3 text-slate-400">
                  {u.createdAt ? u.createdAt.toISOString().slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
