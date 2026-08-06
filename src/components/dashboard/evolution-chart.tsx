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
import { formatPercent } from "@/lib/utils";

const dataFormatter = (value: number) => formatPercent(value, 0);

export function EvolutionChart({ data }: { data: EvolutionPoint[] }) {
  const chartData = data.map((d) => ({
    dia: new Date(d.dia + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    "Taxa de acerto (%)": Math.round(d.taxa * 100),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evolução de acertos</CardTitle>
        <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="evolucao" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={20}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip formatter={(v) => [`${v}%`, "Acerto"]} />
              <Area
                type="monotone"
                dataKey="Taxa de acerto (%)"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#evolucao)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
