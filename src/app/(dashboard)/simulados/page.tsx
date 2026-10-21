import type { Metadata } from "next";
import { Target } from "lucide-react";
import { SimuladoRunner } from "@/components/simulados/simulado-runner";

export const metadata: Metadata = {
  title: "Simulados Cronometrados · ConcursoAI",
  description: "Simulados oficiais CBM-RJ e personalizados com cronômetro regressivo, folha de respostas e relatório pós-prova.",
};

export default function SimuladosPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <SimuladoRunner />
      </main>
    </div>
  );
}
