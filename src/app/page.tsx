import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CalendarCheck2,
  ChartNoAxesCombined,
  CheckCircle2,
  FileQuestion,
  Layers,
  LineChart,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Bot,
    title: "Professor IA",
    description:
      "Tire dúvidas com um tutor especializado em concursos, alimentado pela DeepSeek. Respostas didáticas, com fundamento legal e dicas de prova.",
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    icon: CalendarCheck2,
    title: "Cronograma inteligente",
    description:
      "Monte seu plano de estudos com disciplinas e tarefas diárias, priorizadas pelo peso de cada matéria no edital.",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: FileQuestion,
    title: "Banco de questões",
    description:
      "Resolva questões das principais bancas (CEBRASPE, FGV, VUNESP, FCC) com gabarito comentado e explicações da IA.",
    gradient: "from-orange-500 to-amber-500",
  },
  {
    icon: Layers,
    title: "Flashcards",
    description:
      "Revisão por repetição espaçada para fixar o conteúdo e não esquecer perto da prova. Simples e eficaz.",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    icon: LineChart,
    title: "Analíticas de desempenho",
    description:
      "Acompanhe sua evolução: taxa de acerto por matéria, tempo de estudo e sequência de dias ativos.",
    gradient: "from-rose-500 to-pink-500",
  },
  {
    icon: Target,
    title: "Foco no edital",
    description:
      "Informe o concurso e a banca alvo e direcione todo o estudo para o que realmente cai na prova.",
    gradient: "from-cyan-500 to-sky-500",
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
  { value: "10+", label: "disciplinas com conteúdo" },
  { value: "5", label: "bancas principais" },
  { value: "2", label: "modelos de IA (Flash e Pro)" },
  { value: "100%", label: "foco em concursos BR" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-background">
      {/* ============ NAVBAR ============ */}
      <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-md dark:bg-background/80">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
              <BrainCircuit className="h-5 w-5" />
            </span>
            <span>
              Concurso<span className="text-blue-600">AI</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#recursos" className="hover:text-foreground">Recursos</a>
            <a href="#como-funciona" className="hover:text-foreground">Como funciona</a>
            <a href="#planos" className="hover:text-foreground">Planos</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/cadastro">
                Começar grátis
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-blue-50 via-white to-white dark:from-blue-950/30 dark:via-background dark:to-background"
          aria-hidden
        />
        <div className="container grid items-center gap-10 py-20 md:grid-cols-2 md:py-28">
          <div className="space-y-6">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              Plataforma de estudos com IA
            </Badge>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Passe no concurso{" "}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                estudando do jeito certo
              </span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Cronograma inteligente, banco de questões, flashcards e um
              <strong> Professor IA</strong> que responde suas dúvidas na hora.
              Tudo focado no seu edital e na sua banca.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href="/cadastro">
                  Começar a estudar grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#recursos">Conhecer recursos</a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              ✓ Grátis para começar &nbsp;·&nbsp; ✓ Sem cartão de crédito
            </p>
          </div>

          {/* Mock de painel */}
          <div className="relative">
            <div className="rounded-2xl border bg-white p-6 shadow-2xl shadow-blue-100 dark:bg-card dark:shadow-none">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Bom dia, Maria! 👋</p>
                  <p className="text-xs text-muted-foreground">TCE-SP · Banca CEBRASPE</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                  🔥 12 dias seguidos
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-muted/40">
                  <p className="text-xs text-muted-foreground">Questões hoje</p>
                  <p className="text-2xl font-bold">42</p>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-muted">
                    <div className="h-full w-3/4 rounded-full bg-blue-600" />
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-muted/40">
                  <p className="text-xs text-muted-foreground">Taxa de acerto</p>
                  <p className="text-2xl font-bold text-emerald-600">78,5%</p>
                  <p className="mt-1 text-xs text-muted-foreground">↑ 4,2% esta semana</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-blue-100">Professor IA</p>
                    <p className="text-sm font-semibold">
                      O que é responsabilidade civil do Estado?
                    </p>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                    <Bot className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="h-1.5 w-11/12 rounded-full bg-white/40" />
                  <div className="h-1.5 w-8/12 rounded-full bg-white/40" />
                  <div className="h-1.5 w-10/12 rounded-full bg-white/40" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="container border-t py-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-extrabold text-blue-600">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ RECURSOS ============ */}
      <section id="recursos" className="container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Tudo o que você precisa para se preparar
          </h2>
          <p className="mt-4 text-muted-foreground">
            Uma única plataforma para planejar, estudar, revisar e medir sua evolução.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border bg-white p-6 transition-shadow hover:shadow-lg dark:bg-card"
            >
              <div
                className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.gradient} text-white shadow-sm`}
              >
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ COMO FUNCIONA ============ */}
      <section id="como-funciona" className="border-y bg-slate-50 py-20 dark:bg-muted/20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Comece em 4 passos
            </h2>
            <p className="mt-4 text-muted-foreground">
              Da inscrição ao dia da prova, a ConcursoAI acompanha sua jornada.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.number} className="relative">
                <p className="text-5xl font-extrabold text-blue-100 dark:text-blue-900">
                  {s.number}
                </p>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PLANOS ============ */}
      <section id="planos" className="container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Planos simples
          </h2>
          <p className="mt-4 text-muted-foreground">
            Comece grátis e evolua quando precisar. Cancele quando quiser.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
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
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 px-6 py-16 text-center text-white">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Sua aprovação começa com um plano
            </h2>
            <p className="mt-4 text-blue-100">
              Junte-se a quem estuda com método, dados e um professor que nunca
              se cansa de explicar.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50" asChild>
                <Link href="/cadastro">
                  Criar conta grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-blue-100">
              {["Sem cartão", "Cancele quando quiser", "Suporte pt-BR"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t py-10">
        <div className="container flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2 font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
              <BrainCircuit className="h-4 w-4" />
            </span>
            <span>
              Concurso<span className="text-blue-600">AI</span>
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ConcursoAI. Feito com foco na sua aprovação. 🇧🇷
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">Entrar</Link>
            <Link href="/cadastro" className="hover:text-foreground">Criar conta</Link>
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
          ? "border-blue-600 bg-gradient-to-b from-blue-50 to-white shadow-xl shadow-blue-100 dark:from-blue-950/30 dark:to-card"
          : "bg-white dark:bg-card"
      }`}
    >
      {highlight && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600">
          Mais popular
        </Badge>
      )}
      <h3 className="text-lg font-semibold">{name}</h3>
      <p className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold">{price}</span>
        <span className="text-sm text-muted-foreground">{period}</span>
      </p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            {f}
          </li>
        ))}
      </ul>
      <Button
        className="mt-6 w-full"
        variant={highlight ? "default" : "outline"}
        asChild
      >
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}
