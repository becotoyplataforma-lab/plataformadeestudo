import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Filter,
  HelpCircle,
  ListChecks,
  Minus,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  FILTROS_TRAVADOS,
  ROTULO_DAS_CHAVES,
  TAMANHO_DE_PAGINA,
  TAMANHOS_DE_PAGINA,
  alternarFiltro,
  chipsDeFiltro,
  filtroEhPadrao,
  queryDeFiltros,
  rotuloDaTag,
  semAChave,
  type AbaComTotal,
  type ChaveDeContagem,
  type FiltrosCaderno,
  type OpcaoFaceta,
  type RefinamentosCaderno,
} from "@/lib/questoes/cadernos";

export interface BarraFiltrosProps {
  acao: string;
  filtros: FiltrosCaderno;
  opcoes: Partial<Record<ChaveDeContagem, OpcaoFaceta[]>>;
  abas: AbaComTotal[];
  refinamentos: RefinamentosCaderno;
  porPagina: number;
}

const CLASSE_CAMPO =
  "h-10 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 shadow-sm transition-all focus:border-[#005953] focus:outline-none focus:ring-2 focus:ring-[#005953]/20";
const CLASSE_ROTULO = "block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1";

/** "Todos os/as …" de cada select */
const TODO_DAS_FACETAS: Record<ChaveDeContagem, string> = {
  disciplina: "Todas as disciplinas",
  assunto: "Todos os assuntos",
  banca: "Todas as bancas",
  orgao: "Todos os órgãos",
  cargo: "Todos os cargos",
  origem: "Todas as procedências",
  ano: "Todos os anos",
  tipo: "Todas as modalidades",
};

const FACETAS_LINHA_1: ChaveDeContagem[] = ["disciplina", "assunto", "banca", "orgao", "ano"];
const FACETAS_LINHA_2: ChaveDeContagem[] = ["cargo", "tipo", "origem"];

function Campo({
  nome,
  valores,
  atual,
}: {
  nome: ChaveDeContagem;
  valores: OpcaoFaceta[];
  atual: string | null;
}) {
  return (
    <div className="min-w-0">
      <label className={CLASSE_ROTULO}>{ROTULO_DAS_CHAVES[nome]}</label>
      <select
        name={nome}
        defaultValue={atual ?? ""}
        className={CLASSE_CAMPO}
        data-faceta={nome}
      >
        <option value="">{TODO_DAS_FACETAS[nome]}</option>
        {valores.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {rotuloDaTag(nome, opcao.valor)} ({opcao.total})
          </option>
        ))}
      </select>
    </div>
  );
}

function CaixaRefinamento({
  nome,
  rotulo,
  total,
  ativo,
}: {
  nome: "gabarito" | "anuladas" | "ineditas";
  rotulo: string;
  total: number;
  ativo: boolean;
}) {
  return (
    <label
      className={`inline-flex items-center gap-2.5 rounded-lg border px-3.5 py-2 text-xs font-medium cursor-pointer transition-all ${
        ativo
          ? "border-[#005953] bg-[#005953]/10 text-[#005953] dark:border-teal-500 dark:bg-teal-950/40 dark:text-teal-300"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      <input
        type="checkbox"
        name={nome}
        value={nome === "gabarito" ? "todos" : "excluir"}
        defaultChecked={ativo}
        className="h-4 w-4 rounded border-slate-300 text-[#005953] focus:ring-[#005953]"
        data-refinamento={nome}
      />
      <span>{rotulo}</span>
      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
        {total}
      </span>
    </label>
  );
}

const ICONES_DAS_ABAS = {
  objetivas: ListChecks,
  fixacao: BookOpen,
} as const;

export function BarraFiltros({
  acao,
  filtros,
  opcoes,
  abas,
  refinamentos,
  porPagina,
}: BarraFiltrosProps) {
  const chips = chipsDeFiltro(filtros);
  const abaAtiva = abas.find((aba) => aba.valor === filtros.bloco) ?? abas[0] ?? null;

  const avancadoAtivo =
    filtros.cargo !== null ||
    filtros.tipo !== null ||
    filtros.origem !== null ||
    filtros.gabarito !== "confiavel" ||
    filtros.anuladas !== null ||
    filtros.ineditas !== null ||
    filtros.bloco !== "objetivas";

  const campoLinha1 = (nome: ChaveDeContagem) => (
    <Campo
      key={nome}
      nome={nome}
      valores={opcoes[nome] ?? []}
      atual={filtros[nome] === null ? null : String(filtros[nome])}
    />
  );

  const campoLinha2 = (nome: ChaveDeContagem) => (
    <Campo
      key={nome}
      nome={nome}
      valores={opcoes[nome] ?? []}
      atual={filtros[nome] === null ? null : String(filtros[nome])}
    />
  );

  const hrefSem = (chave: Parameters<typeof semAChave>[1]) => {
    const query = queryDeFiltros(semAChave(filtros, chave));
    return query.length > 0 ? `${acao}?${query}` : acao;
  };

  const hrefAba = (valor: FiltrosCaderno["bloco"]) => {
    const query = queryDeFiltros(alternarFiltro(filtros, "bloco", valor));
    return query.length > 0 ? `${acao}?${query}` : acao;
  };

  return (
    <form
      method="get"
      action={acao}
      className="space-y-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-5 shadow-sm sm:p-6"
      aria-label="Filtros de questões"
    >
      {/* 1. TOPO: BARRA DE STATUS / ABAS ESTILO QCONCURSOS */}
      <div className="flex flex-col gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2" role="tablist">
          {abas.map((aba) => {
            const Icone = ICONES_DAS_ABAS[aba.valor];
            const ativa = filtros.bloco === aba.valor;
            return (
              <Link
                key={aba.valor}
                href={hrefAba(aba.valor)}
                role="tab"
                aria-selected={ativa}
                data-aba={aba.valor}
                title={aba.descricao}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all shadow-sm ${
                  ativa
                    ? "bg-[#005953] text-white shadow-[#005953]/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Icone className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{aba.rotulo}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] tabular-nums ${
                    ativa
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {aba.total}
                </span>
              </Link>
            );
          })}
        </div>

        {abaAtiva && (
          <p className="text-xs text-slate-500 dark:text-slate-400" data-aba-descricao={abaAtiva.valor}>
            {abaAtiva.descricao}
          </p>
        )}
      </div>

      {/* 2. CAMPO PRINCIPAL DE BUSCA POR TEXTO / COMANDO */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          name="palavra"
          defaultValue={filtros.palavra ?? ""}
          placeholder="Busque por palavra-chave no texto ou comando da questão (ex.: crase, concordância, FGV)..."
          className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 pl-11 pr-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#005953] focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#005953]/20 transition-all shadow-inner"
          data-faceta="palavra"
        />
      </div>

      {/* 3. FILTROS MAIS USADOS (GRADE EM 2 LINHAS) */}
      <div className="space-y-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/30 p-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[#005953] dark:text-teal-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#005953] dark:text-teal-300">
            Filtros mais usados
          </h3>
        </div>

        {/* Linha 1: Disciplina, Assunto, Banca, Órgão, Ano */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FACETAS_LINHA_1.map(campoLinha1)}
        </div>

        {/* Linha 2: Cargo, Modalidade (Tipo), Procedência (Origem) */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FACETAS_LINHA_2.map(campoLinha2)}
        </div>
      </div>

      {/* 4. FILTROS AVANÇADOS / EXCLUSÕES E REFINAMENTOS */}
      <details className="group space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 p-4 transition-all" open={avancadoAtivo} data-filtro-avancado>
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-[#005953] dark:hover:text-teal-400 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#005953] dark:text-teal-400" />
            <span>Filtros avançados e exclusões</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="hidden group-open:inline-flex items-center gap-1">
              <Minus className="h-3.5 w-3.5" /> Recolher
            </span>
            <span className="inline-flex group-open:hidden items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Expandir
            </span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </div>
        </summary>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <CaixaRefinamento
            nome="gabarito"
            rotulo="Incluir questões em revisão"
            total={refinamentos.revisao}
            ativo={filtros.gabarito === "todos"}
          />
          {refinamentos.anuladas > 0 && (
            <CaixaRefinamento
              nome="anuladas"
              rotulo="Excluir anuladas"
              total={refinamentos.anuladas}
              ativo={filtros.anuladas === "excluir"}
            />
          )}
          {refinamentos.ineditas > 0 && (
            <CaixaRefinamento
              nome="ineditas"
              rotulo="Excluir inéditas"
              total={refinamentos.ineditas}
              ativo={filtros.ineditas === "excluir"}
            />
          )}
        </div>

        <details className="mt-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5" />
            Ver filtros não indexados neste acervo
          </summary>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-500 dark:text-slate-400 pl-5 list-disc">
            {FILTROS_TRAVADOS.map((travado) => (
              <li key={travado.rotulo}>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{travado.rotulo}</span>:{" "}
                {travado.motivo}
              </li>
            ))}
          </ul>
        </details>
      </details>

      {/* 5. FILTROS APLICADOS + BARRA DE AÇÕES (RODAPÉ) */}
      <div className="flex flex-col gap-4 border-t border-slate-100 dark:border-slate-800/80 pt-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Chips de filtros aplicados */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Filtros aplicados:
          </span>
          {chips.length === 0 ? (
            <span className="text-xs text-slate-400 italic">
              Nenhum filtro adicional aplicado
            </span>
          ) : (
            chips.map((chip) => (
              <span
                key={chip.chave}
                data-chip={chip.chave}
                className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/60 px-3 py-1 text-xs text-teal-900 dark:text-teal-200 shadow-sm"
              >
                <span className="font-semibold text-teal-700 dark:text-teal-400">{chip.rotulo}:</span>
                <span>{chip.valor}</span>
                <Link
                  href={hrefSem(chip.chave)}
                  aria-label={`Remover filtro de ${chip.rotulo.toLowerCase()}`}
                  className="ml-1 rounded-full p-0.5 hover:bg-teal-200/50 dark:hover:bg-teal-800 text-teal-700 dark:text-teal-300 transition-colors"
                >
                  <X className="h-3 w-3" />
                </Link>
              </span>
            ))
          )}
        </div>

        {/* Controles de Paginação & Ações */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
            <span>Exibir</span>
            <select
              name="por"
              defaultValue={porPagina === TAMANHO_DE_PAGINA ? "" : String(porPagina)}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-[#005953] focus:ring-1 focus:ring-[#005953]"
            >
              {TAMANHOS_DE_PAGINA.map((n) => (
                <option key={n} value={n === TAMANHO_DE_PAGINA ? "" : String(n)}>
                  {n}
                </option>
              ))}
            </select>
            <span>por página</span>
          </label>

          {!filtroEhPadrao(filtros) && (
            <Link
              href={acao}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar
            </Link>
          )}

          <Button
            type="submit"
            className="bg-[#005953] hover:bg-[#004742] text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-sm transition-all"
          >
            <Search className="mr-1.5 h-3.5 w-3.5" />
            Filtrar questões
          </Button>
        </div>
      </div>
    </form>
  );
}

export default BarraFiltros;
