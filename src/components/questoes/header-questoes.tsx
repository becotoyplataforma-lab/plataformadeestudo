import Link from "next/link";

export interface HeaderQuestoesProps {
  abaAtiva?: "filtro" | "cadernos" | "salvos";
  totalDisponivel?: number;
}

export function HeaderQuestoes({
  abaAtiva = "filtro",
  totalDisponivel,
}: HeaderQuestoesProps) {
  return (
    <div className="bg-[#005c53] pt-6 sm:pt-8 text-white shadow-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Questões
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-teal-100/80">
              Banco com milhares de questões de concursos públicos com gabarito oficial e comentários.
            </p>
          </div>

          {totalDisponivel !== undefined && totalDisponivel > 0 && (
            <div className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-xs border border-white/10 text-teal-100">
              <span>{totalDisponivel} questões no acervo</span>
            </div>
          )}
        </div>

        {/* NAVEGAÇÃO DE ABAS SUPERIORES ESTILO QCONCURSOS */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/questoes"
            className={`rounded-t-lg px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
              abaAtiva === "filtro"
                ? "bg-[#004741] text-white shadow-2xs"
                : "text-white/80 hover:text-white hover:bg-white/10"
            }`}
          >
            Filtro de questões
          </Link>
          <Link
            href="/questoes?aba=cadernos"
            className={`rounded-t-lg px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
              abaAtiva === "cadernos"
                ? "bg-[#004741] text-white shadow-2xs"
                : "text-white/80 hover:text-white hover:bg-white/10"
            }`}
          >
            Cadernos
          </Link>
          <Link
            href="/questoes?aba=salvos"
            className={`rounded-t-lg px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
              abaAtiva === "salvos"
                ? "bg-[#004741] text-white shadow-2xs"
                : "text-white/80 hover:text-white hover:bg-white/10"
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
