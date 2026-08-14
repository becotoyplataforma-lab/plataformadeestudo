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

export function PerformanceChart({ data }: { data: SubjectPerformance[] }) {
  const chartData = data.map((d) => ({
    materia: d.materia.length > 14 ? d.materia.slice(0, 13) + "…" : d.materia,
    "Acerto (%)": Math.round(d.taxa * 100),
    fill: d.color ?? "#3b82f6",
  }));

  const sorted = [...chartData].sort((a, b) => a["Acerto (%)"] - b["Acerto (%)"]);

  return (
    <Card className="h-full border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] shadow-[0_14px_35px_rgba(15,23,42,0.35)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-extrabold tracking-[-0.04em] text-white">Acerto por matéria</CardTitle>
        <p className="text-sm text-slate-400">Piores primeiro — foque nelas</p>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#cbd5e1" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="materia"
                  width={110}
                  tick={{ fontSize: 11, fill: "#cbd5e1" }}
                  tickLine={false}
                  axisLine={false}
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
                <Bar dataKey="Acerto (%)" radius={[0, 8, 8, 0]} barSize={14} fill="#22d3ee" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
