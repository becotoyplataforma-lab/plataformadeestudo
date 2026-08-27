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

  // Heurística de aluno novo: sem tentativas de questão (sinal mais forte de inatividade).
  // Sem flashcards/mensagens de chat não há contagem direta no fetch atual; zero questões
  // já é suficiente para tratar como novo e mostrar o empty state proposital.
  const isNewStudent = summary.total_questoes === 0;

  // Matéria mais fraca (WeaknessAnalysisService retorna pior-primeiro e traz o subjectId).
  const weakestSubject = weakness[0] ?? null;

  // Apostilas mais recentes (sem rastreio de progresso de leitura → usamos a mais recente).
  const apostilas = docs.filter((d) => d.type === "apostila").slice(0, 3);

  return (
    <div className="space-y-6">
      {/* ============ 1. SAUDAÇÃO + CONTEXTO DO CONCURSO ============ */}
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

            {contestRow ? (
              <p className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-300">Estudando para</span>
                <span className="font-bold text-white">{contestRow.title}</span>
                {positionRow && (
                  <>
                    <span className="text-cyan-400">·</span>
                    <span className="font-semibold text-white">{positionRow.name}</span>
                  </>
                )}
              </p>
            ) : (
              <p className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Seu foco</span>
                <Link href="/perfil" className="font-semibold text-cyan-300 underline-offset-2 hover:underline">
                  Defina seu concurso e cargo
                </Link>
              </p>
            )}

            <p className="mt-3 max-w-2xl text-sm text-slate-300 md:text-base">
              {isNewStudent
                ? "Comece agora: resolva questões e estude apostilas para montar seu plano de evolução."
                : "Seu desempenho em destaque para continuar evoluindo com foco, consistência e inteligência."}
            </p>
          </div>

          {!isNewStudent && (
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
          )}
        </div>
      </section>

      {/* ============ 2. CTA PRINCIPAL ============ */}
      <section className="relative overflow-hidden rounded-[28px] border border-cyan-400/25 bg-[linear-gradient(135deg,rgba(8,145,178,0.22),rgba(15,23,42,0.92))] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.5)]">
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {isNewStudent ? (
              <>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-300">Comece agora</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-white md:text-2xl">
                  Pronto para dar o primeiro passo?
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Resolva questões e estude apostilas para construir seu histórico de desempenho.
                </p>
              </>
            ) : weakestSubject ? (
              <>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-300">Continue estudando</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-white md:text-2xl">
                  Reforce <span className="text-cyan-300">{weakestSubject.subjectName}</span>
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Sua matéria com menor taxa de acerto ({Math.round(weakestSubject.accuracy * 100)}%). Pratique agora para evoluir.
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-300">Continue estudando</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-white md:text-2xl">
                  Mantenha o ritmo
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Resolva mais questões para consolidar seu desempenho.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {isNewStudent ? (
              <>
                <Link
                  href="/questoes"
                  className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.35)] transition-transform hover:-translate-y-0.5"
                >
                  Começar a resolver questões
                </Link>
                <Link
                  href="/apostilas"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
                >
                  Ver apostilas
                </Link>
              </>
            ) : weakestSubject ? (
              <Link
                href={`/questoes?subject_id=${encodeURIComponent(weakestSubject.subjectId)}`}
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.35)] transition-transform hover:-translate-y-0.5"
              >
                Praticar {weakestSubject.subjectName}
              </Link>
            ) : (
              <Link
                href="/questoes"
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.35)] transition-transform hover:-translate-y-0.5"
              >
                Resolver questões
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ============ 3. AÇÕES RÁPIDAS ============ */}
      <QuickActions />

      {/* ============ 4. ESTATÍSTICAS + EVOLUÇÃO ============ */}
      {isNewStudent ? (
        <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/15 text-2xl">
            📈
          </div>
          <h2 className="mt-4 text-lg font-extrabold tracking-[-0.03em] text-white">
            Sua evolução aparece aqui
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Resolva questões para ver seu desempenho por matéria, sua taxa de acerto e seu histórico de evolução.
          </p>
          <Link
            href="/questoes"
            className="mt-5 inline-flex items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-2.5 text-sm font-bold text-cyan-200 transition-colors hover:bg-cyan-500/20"
          >
            Resolver minha primeira questão
          </Link>
        </section>
      ) : (
        <>
          <DashboardStats summary={summary} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <EvolutionChart data={evolution} />
            </div>
            <div>
              <PerformanceChart data={bySubject} />
            </div>
          </div>
        </>
      )}

      {/* ============ 5. CARDS INFORMATIVOS (APOSTILAS RECENTES) ============ */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Link href="/apostilas" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-transform hover:-translate-y-0.5">
          <p className="text-xs text-slate-400">Apostilas</p>
          <p className="mt-1 text-2xl font-bold text-white">{apostilas.length}</p>
        </Link>
        <Link href="/aulas" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-transform hover:-translate-y-0.5">
          <p className="text-xs text-slate-400">Aulas</p>
          <p className="mt-1 text-2xl font-bold text-white">{lessons.length}</p>
        </Link>
        <Link href="/questoes" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-transform hover:-translate-y-0.5">
          <p className="text-xs text-slate-400">Questões respondidas</p>
          <p className="mt-1 text-2xl font-bold text-white">{summary.total_questoes}</p>
        </Link>
      </section>

      {/* Apostilas recentes (quando existirem) */}
      {apostilas.length > 0 && (
        <section className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Apostilas recentes</p>
            <Link href="/apostilas" className="text-xs font-semibold text-cyan-300 hover:underline">
              Ver todas
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {apostilas.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/apostilas/${doc.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 transition-colors hover:bg-white/[0.07]"
                >
                  <span className="truncate text-sm font-semibold text-slate-200">{doc.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {new Date(doc.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
