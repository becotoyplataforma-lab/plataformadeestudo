import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db/drizzle";
import { getDashboardSummary, getPerformanceBySubject, getEvolution } from "@/lib/db/repositories/analises";
import { getProfile } from "@/lib/db/repositories/perfil";
import { DashboardStats, QuickActions } from "@/components/dashboard/dashboard-stats";
import { EvolutionChart } from "@/components/dashboard/evolution-chart";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { LessonRepository } from "@/lib/study/repositories/lesson.repository";
import { WeaknessAnalysisService } from "@/lib/study/services/weakness-analysis.service";
import { contests, positions } from "@/db/schema/contest";
import { firstName } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [summary, bySubject, evolution, profile, docs, lessons, weakness] = await Promise.all([
    getDashboardSummary(session.user.id),
    getPerformanceBySubject(session.user.id),
    getEvolution(session.user.id, 30),
    getProfile(session.user.id),
    DocumentRepository.listByUser(session.user.id, 10),
    LessonRepository.listForStudent(session.user.id, 8),
    WeaknessAnalysisService.analyze(session.user.id, { minAttempts: 1, maxAccuracy: 0.7 }),
  ]);

  // Concurso/cargo do aluno (quando configurado no perfil)
  const [contestRow] = profile?.contest_id
    ? await db.select().from(contests).where(eq(contests.id, profile.contest_id!)).limit(1)
    : [null];
  const [positionRow] = profile?.position_id
    ? await db.select().from(positions).where(eq(positions.id, profile.position_id!)).limit(1)
    : [null];

  const continueLesson = lessons[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.22),transparent_26%),linear-gradient(135deg,rgba(15,23,42,0.97),rgba(11,18,31,0.88))] p-6 shadow-[0_30px_100px_rgba(2,6,23,0.7)]">
        <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-8 left-20 h-28 w-28 rounded-full bg-cyan-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-200">
              Dashboard
            </p>
            <h1 className="text-3xl font-extrabold tracking-[-0.06em] text-white md:text-5xl">
              Olá, {firstName(profile?.full_name)} 👋
            </h1>
            {contestRow && (
              <p className="mt-2 text-sm text-cyan-200">
                Concurso: <span className="font-semibold text-white">{contestRow.title}</span>
                {positionRow && (
                  <>
                    {" · "}Cargo: <span className="font-semibold text-white">{positionRow.name}</span>
                  </>
                )}
              </p>
            )}
            <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">
              Seu desempenho em destaque para continuar evoluindo com foco, consistência e inteligência.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-left text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.3)]">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Meta</div>
              <div className="mt-1 font-extrabold text-white">{summary.meta_hoje_min ?? 0} min</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.3)]">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Acertos</div>
              <div className="mt-1 font-extrabold text-white">{summary.acertos ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.3)]">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Sequência</div>
              <div className="mt-1 font-extrabold text-white">{summary.streak_dias ?? 0} dias</div>
            </div>
          </div>
        </div>
      </section>

      <DashboardStats summary={summary} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EvolutionChart data={evolution} />
        </div>
        <div>
          <PerformanceChart data={bySubject} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/apostilas" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-transform hover:-translate-y-0.5">
          <p className="text-xs text-slate-400">Apostilas disponíveis</p>
          <p className="mt-1 text-2xl font-bold text-white">{docs.length}</p>
        </Link>
        <Link href="/aulas" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-transform hover:-translate-y-0.5">
          <p className="text-xs text-slate-400">Aulas disponíveis</p>
          <p className="mt-1 text-2xl font-bold text-white">{lessons.length}</p>
        </Link>
        <Link href="/questoes" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-transform hover:-translate-y-0.5">
          <p className="text-xs text-slate-400">Questões respondidas</p>
          <p className="mt-1 text-2xl font-bold text-white">{summary.total_questoes}</p>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {continueLesson ? (
          <Link
            href={`/aulas/${continueLesson.id}`}
            className="rounded-[24px] border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,145,178,0.18),rgba(15,23,42,0.9))] p-5"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Continuar estudando</p>
            <p className="mt-1 text-lg font-bold text-white">{continueLesson.title}</p>
            <p className="mt-1 text-sm text-slate-400">Retome sua última aula.</p>
          </Link>
        ) : (
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Continuar estudando</p>
            <p className="mt-2 text-sm text-slate-500">
              Nenhuma aula ainda.{" "}
              <Link href="/aulas" className="text-cyan-300">
                Ver aulas
              </Link>{" "}
              ou{" "}
              <Link href="/apostilas" className="text-cyan-300">
                estudar apostilas
              </Link>
              .
            </p>
          </div>
        )}

        <div className="rounded-[24px] border border-amber-400/20 bg-amber-500/5 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Você precisa reforçar</p>
          {weakness.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Sem fraquezas detectadas ainda — responda mais questões para gerar análise.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {weakness.slice(0, 3).map((w) => (
                <li key={w.subjectId} className="flex items-center justify-between text-sm">
                  <span className="text-slate-200">{w.subjectName}</span>
                  <span className="font-semibold text-amber-300">{Math.round(w.accuracy * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <QuickActions />
    </div>
  );
}
