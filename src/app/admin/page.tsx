import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  CreditCard,
  Trophy,
  FileText,
  HelpCircle,
  ClipboardCheck,
  PlayCircle,
  UserRound,
  MessageSquare,
  Cpu,
  BookOpen,
  Sparkles,
  LayoutGrid,
  BrainCircuit,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AdminDashboardRepository } from "@/lib/administration/repositories/admin-dashboard.repository";
import { StatCard } from "@/components/admin/stat-card";
import { cn } from "@/lib/utils";

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
    href?: string;
    icon: LucideIcon;
    iconClassName: string;
    variant?: "default" | "finance" | "alert";
    chip?: string;
    trend?: { direction: "up" | "down" | "neutral"; text: string };
  }[] = [
    {
      label: "MRR",
      value: formatBRL(stats.mrrCents),
      href: "/admin/financeiro",
      icon: DollarSign,
      iconClassName: "text-emerald-300",
      variant: "finance",
      chip: "R$",
      trend: { direction: stats.mrrCents > 0 ? "up" : "neutral", text: "Receita recorrente mensal" },
    },
    {
      label: "Receita do mês",
      value: formatBRL(stats.monthRevenueCents),
      href: "/admin/financeiro",
      icon: TrendingUp,
      iconClassName: "text-emerald-300",
      variant: "finance",
      chip: "R$",
      trend: { direction: "up", text: "Pagamentos aprovados" },
    },
    {
      label: "Assinaturas ativas",
      value: formatInt(stats.activeSubscriptions),
      href: "/admin/financeiro",
      icon: Users,
      iconClassName: "text-blue-300",
    },
    {
      label: "Inadimplência",
      value: formatInt(stats.pastDueSubscriptions + stats.pendingPaymentsMonth),
      href: "/admin/financeiro",
      icon: AlertTriangle,
      iconClassName: "text-amber-300",
      variant: stats.pastDueSubscriptions + stats.pendingPaymentsMonth > 0 ? "alert" : "default",
      trend: {
        direction: stats.pastDueSubscriptions + stats.pendingPaymentsMonth > 0 ? "down" : "neutral",
        text: `${stats.pastDueSubscriptions} past_due · ${stats.pendingPaymentsMonth} pendentes`,
      },
    },
    {
      label: "Churn do mês",
      value: formatInt(stats.churnMonth),
      href: "/admin/financeiro",
      icon: TrendingDown,
      iconClassName: "text-rose-300",
      variant: stats.churnMonth > 0 ? "alert" : "default",
      trend: {
        direction: stats.churnMonth > 0 ? "down" : "neutral",
        text: "Cancelamentos/expirados",
      },
    },
    {
      label: "Novos pagamentos",
      value: formatInt(stats.newPaymentsMonth),
      href: "/admin/financeiro",
      icon: CreditCard,
      iconClassName: "text-emerald-300",
      variant: "finance",
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
    { label: "Questões", value: formatInt(stats.totalQuestions), href: "/admin/questoes", icon: HelpCircle, iconClassName: "text-emerald-300" },
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

  // ============================================================
  // Cabeçalhos de seção
  // ============================================================
  const sections = [
    {
      id: "financeiro",
      icon: Wallet,
      iconClassName: "text-emerald-300",
      title: "Visão Financeira",
      description: "Receita, assinaturas e inadimplência",
      accent: "from-emerald-400/40",
    },
    {
      id: "operacao",
      icon: LayoutGrid,
      iconClassName: "text-cyan-300",
      title: "Operação",
      description: "Conteúdo, alunos e processamento",
      accent: "from-cyan-400/40",
    },
    {
      id: "ia",
      icon: BrainCircuit,
      iconClassName: "text-fuchsia-300",
      title: "IA & Custo",
      description: "Consumo de modelos e tokens",
      accent: "from-fuchsia-400/40",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Visão geral
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">
              Números reais do sistema e indicadores financeiros.
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Painel ao vivo
          </div>
        </div>
      </div>

      {/* Seção — Visão Financeira */}
      <section className="space-y-4">
        <SectionHeader
          icon={sections[0].icon}
          iconClassName={sections[0].iconClassName}
          title={sections[0].title}
          description={sections[0].description}
          accent={sections[0].accent}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {financialCards.map((c) => (
            <StatCard
              key={c.label}
              label={c.label}
              value={c.value}
              href={c.href}
              icon={c.icon}
              iconClassName={c.iconClassName}
              trend={c.trend}
              variant={c.variant}
              chip={c.chip}
            />
          ))}
        </div>
      </section>

      {/* Seção — Operação */}
      <section className="space-y-4">
        <SectionHeader
          icon={sections[1].icon}
          iconClassName={sections[1].iconClassName}
          title={sections[1].title}
          description={sections[1].description}
          accent={sections[1].accent}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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

      {/* Seção — IA & Custo */}
      <section className="space-y-4">
        <SectionHeader
          icon={sections[2].icon}
          iconClassName={sections[2].iconClassName}
          title={sections[2].title}
          description={sections[2].description}
          accent={sections[2].accent}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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

/** Cabeçalho de seção com ícone, título e divisor sutil. */
function SectionHeader({
  icon: Icon,
  iconClassName,
  title,
  description,
  accent,
}: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/5 pb-3">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-inset ring-white/10",
          iconClassName
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-200">
          {title}
        </h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <span
        className={cn(
          "h-px flex-1 bg-gradient-to-r to-transparent",
          accent
        )}
      />
    </div>
  );
}
