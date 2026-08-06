"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMinutes, formatPercent } from "@/lib/utils";
import type { DashboardSummary, EvolutionPoint, SubjectPerformance } from "@/types";

interface Props {
  summary: DashboardSummary;
  bySubject: SubjectPerformance[];
  evolution: EvolutionPoint[];
  tasks: { scheduled_date: string; duration_min: number; status: string }[];
}

const COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
];

export function AnalisesClient({ summary, bySubject, evolution, tasks }: Props) {
  // Agrega tempo de estudo por dia (tarefas concluídas)
  const studyByDay = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.status !== "concluida") continue;
      const day = t.scheduled_date;
      map.set(day, (map.get(day) ?? 0) + (t.duration_min ?? 0));
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([dia, minutos]) => ({
        dia: new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        "Minutos": minutos,
      }));
  }, [tasks]);

  // Distribuição por matéria (donut) — só matérias com tentativas
  const donutData = bySubject
    .filter((s) => s.total > 0)
    .map((s, i) => ({
      name: s.materia,
      value: s.total,
      color: s.color ?? COLORS[i % COLORS.length],
    }));

  const chartEvolution = evolution.map((e) => ({
    dia: new Date(e.dia + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    "Acerto (%)": Math.round(e.taxa * 100),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analíticas de desempenho</h1>
        <p className="text-sm text-muted-foreground">
          Seus números de estudo e evolução.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Taxa de acerto global</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">
              {formatPercent(summary.taxa_acerto)}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.acertos} acertos em {summary.total_questoes} questões
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sequência de estudos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-500">
              {summary.streak_dias} <span className="text-base text-muted-foreground">dias</span>
            </p>
            <p className="text-xs text-muted-foreground">Mantenha o ritmo! 🔥</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revisões pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-violet-500">{summary.revisoes_pendentes}</p>
            <p className="text-xs text-muted-foreground">Flashcards para hoje</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Evolução */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução de acertos</CardTitle>
            <CardDescription>Últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartEvolution} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => [`${v}%`, "Acerto"]} />
                  <Bar dataKey="Acerto (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tempo de estudo */}
        <Card>
          <CardHeader>
            <CardTitle>Tempo de estudo</CardTitle>
            <CardDescription>Minutos por dia (tarefas concluídas)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studyByDay} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => [formatMinutes(Number(v)), "Tempo"]} />
                  <Bar dataKey="Minutos" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tabela por matéria */}
        <Card>
          <CardHeader>
            <CardTitle>Desempenho por matéria</CardTitle>
            <CardDescription>Ordem crescente de acerto — piores primeiro</CardDescription>
          </CardHeader>
          <CardContent>
            {bySubject.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Resolva questões para popular esta análise.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matéria</TableHead>
                    <TableHead>Questões</TableHead>
                    <TableHead className="text-right">Acerto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bySubject.map((s) => (
                    <TableRow key={s.materia}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: s.color ?? "#3b82f6" }}
                          />
                          {s.materia}
                        </span>
                      </TableCell>
                      <TableCell>{s.total}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={
                              s.taxa >= 0.7
                                ? "text-emerald-600"
                                : s.taxa >= 0.5
                                  ? "text-amber-600"
                                  : "text-red-600"
                            }
                          >
                            {formatPercent(s.taxa)}
                          </span>
                          <Progress value={s.taxa * 100} className="w-16" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Distribuição */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de estudos</CardTitle>
            <CardDescription>Proporção de questões por matéria</CardDescription>
          </CardHeader>
          <CardContent>
            {donutData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sem dados suficientes ainda.
              </p>
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {donutData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [`${v} questões`, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {donutData.map((d) => (
                    <Badge key={d.name} variant="secondary" className="text-xs">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
