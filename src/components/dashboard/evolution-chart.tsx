"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvolutionPoint } from "@/types";

export function EvolutionChart({ data }: { data: EvolutionPoint[] }) {
  const chartData = data.map((d) => ({
    dia: new Date(d.dia + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    "Taxa de acerto (%)": Math.round(d.taxa * 100),
  }));

  return (
    <Card className="border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] shadow-[0_14px_35px_rgba(15,23,42,0.35)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-extrabold tracking-[-0.04em] text-white">Evolução de acertos</CardTitle>
        <p className="text-sm text-slate-400">Últimos 30 dias</p>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="evolucao" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 11, fill: "#cbd5e1" }}
                tickLine={false}
                axisLine={false}
                minTickGap={20}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#cbd5e1" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(v) => [`${v}%`, "Acerto"]}
                contentStyle={{
                  background: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(148,163,184,0.2)",
                  borderRadius: "12px",
                  color: "#e2e8f0",
                }}
              />
              <Area
                type="monotone"
                dataKey="Taxa de acerto (%)"
                stroke="#22d3ee"
                strokeWidth={3}
                fill="url(#evolucao)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
