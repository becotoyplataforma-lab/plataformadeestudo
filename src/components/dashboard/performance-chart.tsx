"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SubjectPerformance } from "@/types";
import { formatPercent } from "@/lib/utils";

export function PerformanceChart({ data }: { data: SubjectPerformance[] }) {
  const chartData = data.map((d) => ({
    materia: d.materia.length > 14 ? d.materia.slice(0, 13) + "…" : d.materia,
    "Acerto (%)": Math.round(d.taxa * 100),
    fill: d.color ?? "#3b82f6",
  }));

  const sorted = [...chartData].sort((a, b) => a["Acerto (%)"] - b["Acerto (%)"]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Acerto por matéria</CardTitle>
        <p className="text-sm text-muted-foreground">
          Piores primeiro — foque nelas
        </p>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Resolva questões para ver seu desempenho por matéria.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sorted}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="materia"
                  width={110}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip formatter={(v) => [`${v}%`, "Acerto"]} />
                <Bar dataKey="Acerto (%)" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
