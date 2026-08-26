import {
  Banknote,
  TrendingUp,
  Users,
  AlertTriangle,
  UserMinus,
  CreditCard,
  Trophy,
  FileText,
  ListChecks,
  ClipboardCheck,
  PlayCircle,
  UserRound,
  MessageSquare,
  Cpu,
  BookOpen,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { AdminDashboardRepository } from "@/lib/administration/repositories/admin-dashboard.repository";
import { StatCard } from "@/components/admin/stat-card";

export const dynamic = "force-dynamic";

/** Formata centavos em BRL. */
function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/** Formata número inteiro com separador pt-BR. */
function formatInt(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export default async function AdminPage() {
  const stats = await AdminDashboardRepository.stats();

  // ============================================================
  // Linha 1 — Visão Financeira (KPIs críticos)
  // ============================================================
  const financialCards: {
    label: string;
    value: string;
    icon: LucideIcon;
    iconClassName: string;
    trend?: { direction: "up" | "down" | "neutral"; text: string };
  }[] = [
    {
      label: "MRR",
      value: formatBRL(stats.mrrCents),
      icon: TrendingUp,
      iconClassName: "text-cyan-300",
      trend: { direction: "up", text: "Receita recorrente mensal" },
    },
    {
      label: "Receita do mês",
      value: formatBRL(stats.monthRevenueCents),
      icon: Banknote,
      iconClassName: "text-emerald-300",
      trend: { direction: "up", text: "Pagamentos aprovados" },
    },
    {
      label: "Assinaturas ativas",
      value: formatInt(stats.activeSubscriptions),
      icon: Users,
      iconClassName: "text-blue-300",
    },
    {
      label: "Inadimplência",
      value: formatInt(stats.pastDueSubscriptions + stats.pendingPaymentsMonth),
      icon: AlertTriangle,
      iconClassName: "text-amber-300",
      trend: {
        direction: stats.pastDueSubscriptions + stats.pendingPaymentsMonth > 0 ? "down" : "neutral",
        text: `${stats.pastDueSubscriptions} past_due · ${stats.pendingPaymentsMonth} pendentes`,
      },
    },
    {
      label: "Churn do mês",
      value: formatInt(stats.churnMonth),
      icon: UserMinus,
      iconClassName: "text-rose-300",
      trend: {
        direction: stats.churnMonth > 0 ? "down" : "neutral",
        text: "Cancelamentos/expirados",
      },
    },
    {
      label: "Novos pagamentos",
      value: formatInt(stats.newPaymentsMonth),
      icon: CreditCard,
      iconClassName: "text-violet-300",
      trend: { direction: "up", text: "Aprovados no mês" },
    },
  ];

  // ============================================================
  // Linha 2 — Operação (cards clicáveis)
  // ============================================================
  const operationCards: {
    label: string;
    value: string;
    href: string;
    icon: LucideIcon;
    iconClassName: string;
    alert?: boolean;
  }[] = [
    { label: "Alunos", value: formatInt(stats.totalUsers), href: "/admin/alunos", icon: Users, iconClassName: "text-cyan-300" },
    { label: "Concursos", value: formatInt(stats.totalContests), href: "/admin/concursos", icon: Trophy, iconClassName: "text-amber-300" },
    { label: "Editais", value: formatInt(stats.totalEditais), href: "/admin/concursos", icon: FileText, iconClassName: "text-orange-300" },
    { label: "Apostilas", value: formatInt(stats.totalDocuments), href: "/admin/apostilas", icon: BookOpen, iconClassName: "text-blue-300" },
    {
      label: "Apostilas com erro",
      value: formatInt(stats.documentsFailed),
      href: "/admin/apostilas",
      icon: AlertTriangle,
      iconClassName: "text-rose-300",
      alert: stats.documentsFailed > 0,
    },
    { label: "Questões", value: formatInt(stats.totalQuestions), href: "/admin/questoes", icon: ListChecks, iconClassName: "text-emerald-300" },
    {
      label: "Aguardando revisão",
      value: formatInt(stats.pendingReviews),
      href: "/admin/questoes/revisao",
      icon: ClipboardCheck,
      iconClassName: "text-amber-300",
      alert: stats.pendingReviews > 0,
    },
    { label: "Aulas", value: formatInt(stats.totalLessons), href: "/admin/aulas", icon: PlayCircle, iconClassName: "text-violet-300" },
    { label: "Avatares", value: formatInt(stats.totalAvatars), href: "/admin/avatares", icon: UserRound, iconClassName: "text-pink-300" },
  ];

  // ============================================================
  // Linha 3 — IA & Custo
  // ============================================================
  const aiCards: {
    label: string;
    value: string;
    href?: string;
    icon: LucideIcon;
    iconClassName: string;
  }[] = [
    { label: "Mensagens IA", value: formatInt(stats.aiMessagesTotal), href: "/admin/ia", icon: MessageSquare, iconClassName: "text-cyan-300" },
    { label: "Tokens consumidos", value: formatInt(stats.aiTokensTotal), href: "/admin/ia", icon: Cpu, iconClassName: "text-fuchsia-300" },
  ];

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Visão geral</h2>
        <p className="mt-1 text-sm text-slate-400">
          Números reais do sistema e indicadores financeiros.
        </p>
      </div>

      {/* Linha 1 — Visão Financeira */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
            Visão Financeira
          </h3>
          <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/30 to-transparent" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {financialCards.map((c) => (
            <StatCard
              key={c.label}
              label={c.label}
              value={c.value}
              icon={c.icon}
              iconClassName={c.iconClassName}
              trend={c.trend}
            />
          ))}
        </div>
      </section>

      {/* Linha 2 — Operação */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Operação
          </h3>
          <span className="h-px flex-1 bg-gradient-to-r from-slate-400/30 to-transparent" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {operationCards.map((c) => (
            <StatCard
              key={c.label}
              label={c.label}
              value={c.value}
              href={c.href}
              icon={c.icon}
              iconClassName={c.iconClassName}
              className={c.alert ? "ring-1 ring-inset ring-rose-400/30" : undefined}
            />
          ))}
        </div>
      </section>

      {/* Linha 3 — IA & Custo */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            IA &amp; Custo
          </h3>
          <span className="h-px flex-1 bg-gradient-to-r from-slate-400/30 to-transparent" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {aiCards.map((c) => (
            <StatCard
              key={c.label}
              label={c.label}
              value={c.value}
              href={c.href}
              icon={c.icon}
              iconClassName={c.iconClassName}
            />
          ))}
        </div>
      </section>

      {/* Alerta */}
      {(stats.documentsFailed > 0 || stats.pendingReviews > 0) && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-200">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4" />
            Alertas
          </div>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {stats.documentsFailed > 0 && (
              <li>{stats.documentsFailed} apostila(s) com erro de processamento.</li>
            )}
            {stats.pendingReviews > 0 && (
              <li>{stats.pendingReviews} questão(ões) aguardando revisão.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
