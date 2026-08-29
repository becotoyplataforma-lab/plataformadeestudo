import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CalendarCheck2,
  CheckCircle2,
  FileQuestion,
  Layers,
  LineChart,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LandingLogo } from "@/components/landing/landing-logo";

export const metadata: Metadata = {
  title: "ConcursoAI — Estudos com IA para concursos públicos",
  description:
    "Cronograma inteligente, banco de questões, flashcards e Professor IA para você passar no concurso público. Estude com inteligência artificial.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "ConcursoAI — Estudos com IA para concursos públicos",
    description:
      "Cronograma inteligente, banco de questões, flashcards e Professor IA para você passar no concurso.",
    url: "/",
    type: "website",
  },
};

const features = [
  {
    icon: Bot,
    title: "Professor IA",
    description:
      "Tire dúvidas com um tutor especializado em concursos, alimentado pela DeepSeek. Respostas didáticas, com fundamento legal e dicas de prova.",
    gradient: "from-cyan-400 to-blue-600",
  },
  {
    icon: CalendarCheck2,
    title: "Cronograma inteligente",
    description:
      "Monte seu plano de estudos com disciplinas e tarefas diárias, priorizadas pelo peso de cada matéria no edital.",
    gradient: "from-emerald-400 to-teal-600",
  },
  {
    icon: FileQuestion,
    title: "Banco de questões",
    description:
      "Resolva questões das principais bancas (CEBRASPE, FGV, VUNESP, FCC) com gabarito comentado e explicações da IA.",
    gradient: "from-amber-400 to-orange-600",
  },
  {
    icon: Layers,
    title: "Flashcards",
    description:
      "Revisão por repetição espaçada para fixar o conteúdo e não esquecer perto da prova. Simples e eficaz.",
    gradient: "from-violet-400 to-purple-600",
  },
  {
    icon: LineChart,
    title: "Analíticas de desempenho",
    description:
      "Acompanhe sua evolução: taxa de acerto por matéria, tempo de estudo e sequência de dias ativos.",
    gradient: "from-rose-400 to-pink-600",
  },
  {
    icon: Target,
    title: "Foco no edital",
    description:
      "Informe o concurso e a banca alvo e direcione todo o estudo para o que realmente cai na prova.",
    gradient: "from-sky-400 to-cyan-600",
  },
];

const steps = [
  {
    number: "01",
    title: "Crie sua conta",
    description: "Cadastro rápido com e-mail. Sem cartão de crédito para começar.",
  },
  {
    number: "02",
    title: "Defina seu objetivo",
    description: "Informe o concurso alvo, a banca e sua disponibilidade diária de estudo.",
  },
  {
    number: "03",
    title: "Estude com a IA",
    description: "Siga o cronograma, resolva questões, revise com flashcards e pergunte ao Professor IA.",
  },
  {
    number: "04",
    title: "Acompanhe e evolua",
    description: "Use as analíticas para corrigir a rota e chegar à prova preparado.",
  },
];

const stats = [
  { value: "+5.000", label: "USUÁRIOS ATIVOS" },
  { value: "100%", label: "BANCAS HACKEADAS" },
  { value: "+40 mil", label: "QUESTÕES" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-transparent">
      {/* ============ NAVBAR ============ */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <LandingLogo />

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-300 md:flex">
            <a href="#recursos" className="hover:text-white transition-colors">FUNCIONALIDADES</a>
            <a href="#como-funciona" className="hover:text-white transition-colors">COMO FUNCIONA</a>
            <a href="#planos" className="hover:text-white transition-colors">INVESTIMENTO</a>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white" asChild>
              <Link href="/login">LOGIN</Link>
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold hover:from-amber-400 hover:to-orange-500 shadow-lg shadow-orange-500/20" asChild>
              <Link href="/cadastro">
                COMEÇAR AGORA!
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden pt-6 pb-4">
        <div className="container grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
              <span className="text-xs font-extrabold tracking-[0.22em] text-emerald-300">STATUS:</span>
              <span className="text-xs font-bold tracking-wider text-emerald-200">MELHOR IA PARA CONCURSO PÚBLICO</span>
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              Passe no{" "}
              <span className="text-gradient-cyan">próximo concurso</span>
              {" "}que fizer, utilizando essa{" "}
              <span className="text-gradient-cyan">IA</span>
              {" "}feita para{" "}
              <span className="text-gradient-cyan">concurseiros!</span>
            </h1>
            <p className="text-base font-semibold text-slate-300 sm:text-lg">
              Funciona para{" "}
              <strong className="text-white">Qualquer Banca</strong>
              {" "}• Funciona para{" "}
              <strong className="text-white">Qualquer Concurso</strong>
              {" "}•{" "}
              <strong className="text-cyan-400">100x mais potente</strong>
              {" "}que o ChatGPT
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-extrabold tracking-wide hover:from-amber-400 hover:to-orange-500 shadow-xl shadow-orange-500/25 text-base px-8 py-6 rounded-xl" asChild>
                <Link href="/cadastro">
                  COMEÇAR AGORA!
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-2xl font-extrabold text-cyan-400">{s.value}</span>
                  <span className="text-xs font-bold tracking-wider text-slate-400">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mock de painel */}
          <div className="relative">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-6 shadow-[0_0_0_1px_rgba(6,182,212,0.12),0_25px_60px_rgba(0,0,0,0.6)]">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex -space-x-2">
                  <span className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">AI</span>
                  <span className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold">🔍</span>
                </div>
                <div className="flex-1 rounded-full bg-slate-800/80 border border-white/5 px-4 py-2 text-sm text-slate-400">
                  Quando sai o próximo concurso da P...
                </div>
                <span className="rounded-full bg-cyan-500/20 border border-cyan-500/30 px-3 py-1 text-xs font-bold text-cyan-300">Modo IA</span>
              </div>
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">EM ALTA:</span>
                <span className="rounded-full bg-slate-800 border border-white/5 px-2.5 py-0.5 text-xs font-semibold text-slate-200">PRF 2026</span>
                <span className="rounded-full bg-slate-800 border border-white/5 px-2.5 py-0.5 text-xs font-semibold text-slate-200">INSS</span>
                <span className="rounded-full bg-slate-800 border border-white/5 px-2.5 py-0.5 text-xs font-semibold text-slate-200">Petrobrás</span>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-cyan-300">
                  <LineChart className="h-3 w-3" />
                  Prévia do seu dashboard
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-2xl bg-slate-800/60 border border-white/5 p-4">
                  <p className="text-xs text-slate-400 mb-1">Questões hoje</p>
                  <p className="text-2xl font-extrabold text-white">42</p>
                </div>
                <div className="rounded-2xl bg-slate-800/60 border border-white/5 p-4">
                  <p className="text-xs text-slate-400 mb-1">Taxa de acerto</p>
                  <p className="text-2xl font-extrabold text-emerald-400">78,5%</p>
                  <p className="text-xs text-emerald-400/70 mt-1">↑ 4,2% esta semana</p>
                </div>
              </div>
              <div className="rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-700 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-cyan-100">Professor IA</p>
                    <p className="text-sm font-semibold">O que é responsabilidade civil do Estado?</p>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                    <Bot className="h-5 w-5" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ RECURSOS ============ */}
      <section id="recursos" className="container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-4 py-1.5 mb-6">
            <span className="text-xs font-extrabold tracking-[0.2em] text-cyan-300">FUNCIONALIDADES!</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl lg:text-5xl">
            Essas são todas as funcionalidades<br />
            que você vai receber na{" "}
            <span className="text-gradient-cyan">Concursa AI</span>
          </h2>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-white/8 bg-gradient-to-b from-slate-900/80 to-slate-950/90 p-6 transition-all hover:border-cyan-500/30 hover:shadow-[0_0_30px_rgba(6,182,212,0.1)]"
            >
              <div
                className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.gradient} text-white shadow-lg`}
              >
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-extrabold tracking-tight">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ COMO FUNCIONA ============ */}
      <section id="como-funciona" className="border-y border-white/5 bg-slate-950/40 py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
              Esses são os 3 passos para<br />
              <span className="text-gradient-cyan">conquistar sua aprovação!</span>
            </h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.number} className="relative">
                <p className="text-5xl font-extrabold text-cyan-400/20">{s.number}</p>
                <h3 className="mt-2 text-lg font-extrabold">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PLANOS ============ */}
      <section id="planos" className="container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-1.5 mb-6">
            <span className="text-xs font-extrabold tracking-[0.2em] text-amber-300">INVESTIMENTO</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
            Escolha o plano ideal para{" "}
            <span className="text-gradient-cyan">sua aprovação</span>
          </h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          <PlanCard
            name="Gratuito"
            price="R$ 0"
            period="/mês"
            features={[
              "Cronograma de estudos",
              "20 questões/dia",
              "50 mensagens IA (V4 Flash)",
              "Flashcards ilimitados",
            ]}
            cta="Começar grátis"
            href="/cadastro"
          />
          <PlanCard
            name="Pro"
            price="R$ 29,90"
            period="/mês"
            highlight
            features={[
              "Tudo do Gratuito",
              "Questões ilimitadas",
              "IA ilimitada (Flash + Pro)",
              "Analíticas avançadas",
              "Histórico completo",
            ]}
            cta="Assinar Pro"
            href="/cadastro"
          />
          <PlanCard
            name="Intensivo"
            price="R$ 49,90"
            period="/mês"
            features={[
              "Tudo do Pro",
              "Knowledge Engine (PDFs, editais)",
              "Simulados estilo banca",
              "Correção de redação",
              "Prioridade no suporte",
            ]}
            cta="Assinar Intensivo"
            href="/cadastro"
          />
        </div>
      </section>

      {/* ============ CTA FINAL ============ */}
      <section className="container pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600 via-blue-700 to-indigo-800 px-6 py-20 text-center text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl lg:text-5xl">
              Sua aprovação começa com<br />
              <span className="text-cyan-300">inteligência artificial</span>
            </h2>
            <p className="mt-4 text-blue-100 text-lg">
              Pare de estudar no escuro. Deixe a IA mostrar o caminho mais rápido para o seu cargo público.
            </p>
            <div className="mt-8">
              <Button size="lg" className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-extrabold tracking-wide hover:from-amber-400 hover:to-orange-500 shadow-xl shadow-orange-500/30 text-base px-10 py-7 rounded-xl" asChild>
                <Link href="/cadastro">
                  COMEÇAR AGORA!
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-white/5 py-10">
        <div className="container flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2 font-extrabold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 text-white">
              <BrainCircuit className="h-4 w-4" />
            </span>
            <span>
              Concurso<span className="text-cyan-400">AI</span>
            </span>
          </div>
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} ConcursoAI — A primeira IA do Brasil desenvolvida exclusivamente para concurso público. 🇧🇷
          </p>
          <div className="flex items-center gap-4 text-sm font-semibold text-slate-400">
            <Link href="/login" className="hover:text-white transition-colors">LOGIN</Link>
            <Link href="/cadastro" className="hover:text-white transition-colors">CRIAR CONTA</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PlanCard({
  name,
  price,
  period,
  features,
  cta,
  href,
  highlight = false,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 ${
        highlight
          ? "border-cyan-500/40 bg-gradient-to-b from-cyan-950/30 to-slate-950 shadow-[0_0_40px_rgba(6,182,212,0.12)]"
          : "border-white/8 bg-gradient-to-b from-slate-900/70 to-slate-950/90"
      }`}
    >
      {highlight && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-600 font-extrabold tracking-wider text-xs">
          MAIS ESCOLHIDO
        </Badge>
      )}
      <h3 className="text-lg font-extrabold tracking-tight">{name}</h3>
      <p className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-white">{price}</span>
        <span className="text-sm text-slate-400">{period}</span>
      </p>
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
            {f}
          </li>
        ))}
      </ul>
      <Button
        className={`mt-6 w-full font-extrabold tracking-wider ${
          highlight
            ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-lg shadow-orange-500/20"
            : "border-white/10 bg-slate-800 text-slate-200 hover:bg-slate-700"
        }`}
        asChild
      >
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}
