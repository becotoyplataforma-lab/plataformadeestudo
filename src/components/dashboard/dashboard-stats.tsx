"use client";

import Link from "next/link";
import {
  CalendarCheck2,
  FileQuestion,
  Flame,
  Layers,
  MessagesSquare,
  Target,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatMinutes, formatPercent } from "@/lib/utils";
import type { DashboardSummary } from "@/types";

export function DashboardStats({ summary }: { summary: DashboardSummary }) {
  const metaProgress = summary.meta_hoje_min
    ? Math.min(100, Math.round((summary.estudado_hoje_min / summary.meta_hoje_min) * 100))
    : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.85))] shadow-[0_10px_30px_rgba(15,23,42,0.3)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-200">Taxa de acerto</CardTitle>
          <Target className="h-4 w-4 text-cyan-300" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">
            {formatPercent(summary.taxa_acerto)}
          </p>
          <p className="text-xs text-slate-400">
            {summary.acertos} de {summary.total_questoes} questões
          </p>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.85))] shadow-[0_10px_30px_rgba(15,23,42,0.3)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-200">Sequência de estudo</CardTitle>
          <Flame className="h-4 w-4 text-orange-400" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">
            {summary.streak_dias}{" "}
            <span className="text-sm font-normal text-slate-400">
              {summary.streak_dias === 1 ? "dia" : "dias"}
            </span>
          </p>
          <p className="text-xs text-slate-400">Mantenha o ritmo! 🔥</p>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.85))] shadow-[0_10px_30px_rgba(15,23,42,0.3)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-200">Meta do dia</CardTitle>
          <Target className="h-4 w-4 text-cyan-300" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">
            {formatMinutes(summary.estudado_hoje_min)}
            <span className="text-sm font-normal text-slate-400">
              {" "}
              / {formatMinutes(summary.meta_hoje_min)}
            </span>
          </p>
          <Progress value={metaProgress} className="mt-3 h-2 bg-slate-800" />
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.85))] shadow-[0_10px_30px_rgba(15,23,42,0.3)]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-slate-200">Revisões pendentes</CardTitle>
          <Layers className="h-4 w-4 text-violet-300" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-white">{summary.revisoes_pendentes}</p>
          <p className="text-xs text-slate-400">Flashcards para revisar hoje</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function QuickActions() {
  const actions = [
    { href: "/questoes", icon: FileQuestion, label: "Resolver questões", desc: "Pratique e veja o gabarito comentado" },
    { href: "/flashcards", icon: Layers, label: "Revisar flashcards", desc: "Repetição espaçada para fixar" },
    { href: "/professor", icon: MessagesSquare, label: "Perguntar ao Professor IA", desc: "Tire dúvidas com a IA" },
    { href: "/cronograma", icon: CalendarCheck2, label: "Ver cronograma", desc: "Planeje sua semana" },
  ];

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-white">Ações rápidas</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => (
          <Card key={a.href} className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.85))] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(14,165,233,0.12)]">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-400/20">
                  <a.icon className="h-4 w-4" />
                </span>
                <span className="font-medium text-white">{a.label}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-400">{a.desc}</p>
              <Button variant="outline" size="sm" className="w-full border-white/10 bg-white/5 text-slate-100 hover:bg-sky-500/10 hover:text-white" asChild>
                <Link href={a.href}>Abrir</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
