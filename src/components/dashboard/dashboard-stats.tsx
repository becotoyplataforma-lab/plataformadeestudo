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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taxa de acerto</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatPercent(summary.taxa_acerto)}
          </p>
          <p className="text-xs text-muted-foreground">
            {summary.acertos} de {summary.total_questoes} questões
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sequência de estudo</CardTitle>
          <Flame className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {summary.streak_dias}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {summary.streak_dias === 1 ? "dia" : "dias"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">Mantenha o ritmo! 🔥</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Meta do dia</CardTitle>
          <Target className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatMinutes(summary.estudado_hoje_min)}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {formatMinutes(summary.meta_hoje_min)}
            </span>
          </p>
          <Progress value={metaProgress} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revisões pendentes</CardTitle>
          <Layers className="h-4 w-4 text-violet-500" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{summary.revisoes_pendentes}</p>
          <p className="text-xs text-muted-foreground">
            Flashcards para revisar hoje
          </p>
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
      <h2 className="mb-3 text-lg font-semibold">Ações rápidas</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => (
          <Card key={a.href} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <a.icon className="h-4 w-4" />
                </span>
                <span className="font-medium text-foreground">{a.label}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{a.desc}</p>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href={a.href}>Abrir</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
