import Link from "next/link";
import { BookOpen, HelpCircle, Layers, Sparkles } from "lucide-react";

export interface HeaderQuestoesProps {
  abaAtiva?: "filtro" | "cadernos" | "salvos";
  totalDisponivel?: number;
}

export function HeaderQuestoes({
  abaAtiva = "filtro",
  totalDisponivel,
}: HeaderQuestoesProps) {
  return (
    <div className="border-b border-white/10 bg-slate-950 pt-6 text-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between pb-6 gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              Banco de Questões · Plataforma
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-white">
              Questões
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Filtro avançado de questões para concursos públicos com gabarito oficial e resolução comentada.
            </p>
          </div>

          {totalDisponivel !== undefined && totalDisponivel > 0 && (
            <div className="inline-flex items-center gap-2 self-start sm:self-auto rounded-2xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300">
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-white font-bold">{totalDisponivel}</span> questões disponíveis
            </div>
          )}
        </div>

        {/* NAVEGAÇÃO DE ABAS SUPERIORES ESTILO APOSTILAS / CYBER TECH */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/questoes"
            className={`rounded-t-xl px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
              abaAtiva === "filtro"
                ? "border-b-2 border-cyan-400 bg-cyan-500/10 text-cyan-300 shadow-2xs"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Filtro de questões
          </Link>
          <Link
            href="/questoes?aba=cadernos"
            className={`rounded-t-xl px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
              abaAtiva === "cadernos"
                ? "border-b-2 border-cyan-400 bg-cyan-500/10 text-cyan-300 shadow-2xs"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Cadernos
          </Link>
          <Link
            href="/questoes?aba=salvos"
            className={`rounded-t-xl px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
              abaAtiva === "salvos"
                ? "border-b-2 border-cyan-400 bg-cyan-500/10 text-cyan-300 shadow-2xs"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            Filtros salvos
          </Link>
        </div>
      </div>
    </div>
  );
}

export default HeaderQuestoes;
