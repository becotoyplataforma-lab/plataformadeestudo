"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Filter,
  ListChecks,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
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

const CLASSE_SELECT =
  "h-10 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 shadow-2xs transition-all focus:border-[#005c53] focus:outline-none focus:ring-1 focus:ring-[#005c53]";
const CLASSE_LABEL = "block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1";

/** Opções padrão para filtros quando não indexados no acervo local */
const LEIS_OPCOES = [
  "Constituição Federal de 1988",
  "Código Penal (Decreto-Lei 2.848/1940)",
  "Código de Processo Penal",
  "Lei 14.133/2021 (Licitações e Contratos)",
  "Lei 8.112/1990 (Regime dos Servidores)",
  "Lei 8.429/1992 (Improbidade Administrativa)",
  "Lei 9.784/1999 (Processo Administrativo)",
  "Código Tributário Nacional",
  "Código de Trânsito Brasileiro",
];

const NIVEIS_OPCOES = ["Superior", "Médio", "Fundamental"];

const DIFICULDADE_OPCOES = [
  "Muito Fácil",
  "Fácil",
  "Média",
  "Difícil",
  "Muito Difícil",
];

const MODALIDADE_OPCOES = ["Múltipla Escolha", "Certo / Errado"];

const AREA_FORMACAO_OPCOES = [
  "Geral",
  "Administração",
  "Direito",
  "Engenharia",
  "Saúde",
  "Tecnologia da Informação",
  "Educação / Licenciaturas",
];

const AREA_ATUACAO_OPCOES = [
  "Segurança Pública / Policial",
  "Militar / Bombeiro",
  "Fiscal / Tributária",
  "Tribunais e Judiciário",
  "Administrativa",
  "Bancária",
];

export function BarraFiltros({
  acao,
  filtros,
  opcoes,
  abas,
  refinamentos,
  porPagina,
}: BarraFiltrosProps) {
  const [subAba, setSubAba] = React.useState<"classico" | "novo">("classico");
  const [statusQuestao, setStatusQuestao] = React.useState<
    "todas" | "nao_resolvidas" | "resolvidas" | "acertei" | "errei"
  >("todas");

  const chips = chipsDeFiltro(filtros);

  const hrefSem = (chave: Parameters<typeof semAChave>[1]) => {
    const query = queryDeFiltros(semAChave(filtros, chave));
    return query.length > 0 ? `${acao}?${query}` : acao;
  };

  // Garante que Disciplina contenha as opções reais do sistema
  const disciplinasValores: OpcaoFaceta[] =
    opcoes.disciplina && opcoes.disciplina.length > 0
      ? opcoes.disciplina
      : [
          { valor: "Língua Portuguesa", total: 886 },
          { valor: "Matemática", total: 1036 },
        ];

  return (
    <form
      method="get"
      action={acao}
      className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden"
      aria-label="Filtros de questões"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
        {/* ================= COLUNA PRINCIPAL DE FILTROS (ESQUERDA: ~75%) ================= */}
        <div className="lg:col-span-9 p-5 sm:p-6 space-y-5">
          {/* 1. SUB-TABS: FILTRO CLÁSSICO / FILTRO NOVO */}
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setSubAba("classico")}
              className={`rounded-t-lg px-5 py-2 text-xs sm:text-sm font-semibold transition-all ${
                subAba === "classico"
                  ? "bg-[#e6f4f2] text-[#005c53] dark:bg-teal-950/60 dark:text-teal-300 border-b-2 border-[#005c53]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              Filtro clássico
            </button>
            <button
              type="button"
              onClick={() => setSubAba("novo")}
              className={`rounded-t-lg px-5 py-2 text-xs sm:text-sm font-medium flex items-center gap-2 transition-all ${
                subAba === "novo"
                  ? "bg-[#e6f4f2] text-[#005c53] dark:bg-teal-950/60 dark:text-teal-300 border-b-2 border-[#005c53]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>Filtro novo</span>
              <span className="bg-[#00a896] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Novidade
              </span>
            </button>
          </div>

          {/* 2. STATUS PILLS ("Minhas questões") */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Minhas questões
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: "todas", label: "Todas" },
                  { id: "nao_resolvidas", label: "Não Resolvidas" },
                  { id: "resolvidas", label: "Resolvidas" },
                  { id: "acertei", label: "Acertei" },
                  { id: "errei", label: "Errei" },
                ] as const
              ).map((p) => {
                const ativo = statusQuestao === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setStatusQuestao(p.id)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                      ativo
                        ? "bg-[#005c53] text-white shadow-2xs"
                        : "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. INPUT DE BUSCA POR PALAVRA-CHAVE */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              name="palavra"
              defaultValue={filtros.palavra ?? ""}
              placeholder="Faça uma busca por palavra chave"
              className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-10 pr-4 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#005c53] focus:outline-none focus:ring-1 focus:ring-[#005c53] transition-all shadow-2xs"
              data-faceta="palavra"
            />
          </div>

          {/* 4. FILTROS MAIS USADOS (8 DROPDOWNS: 2 LINHAS DE 4) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#005c53]" />
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Filtros mais usados
              </h3>
            </div>

            {/* Linha 1: Disciplina, Assunto, Leis, Banca */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Disciplina */}
              <div>
                <label className={CLASSE_LABEL}>Disciplina</label>
                <select
                  name="disciplina"
                  defaultValue={filtros.disciplina ?? ""}
                  className={CLASSE_SELECT}
                  data-faceta="disciplina"
                >
                  <option value="">Todas as disciplinas</option>
                  {disciplinasValores.map((opt) => (
                    <option key={opt.valor} value={opt.valor}>
                      {opt.valor} ({opt.total})
                    </option>
                  ))}
                </select>
              </div>

              {/* Assunto */}
              <div>
                <label className={CLASSE_LABEL}>Assunto</label>
                <select
                  name="assunto"
                  defaultValue={filtros.assunto ?? ""}
                  className={CLASSE_SELECT}
                  data-faceta="assunto"
                >
                  <option value="">Todos os assuntos</option>
                  {(opcoes.assunto ?? []).map((opt) => (
                    <option key={opt.valor} value={opt.valor}>
                      {rotuloDaTag("assunto", opt.valor)} ({opt.total})
                    </option>
                  ))}
                </select>
              </div>

              {/* Leis */}
              <div>
                <label className={CLASSE_LABEL}>Leis</label>
                <select
                  name="leis"
                  defaultValue=""
                  className={CLASSE_SELECT}
                  data-faceta="leis"
                >
                  <option value="">Todas as leis</option>
                  {LEIS_OPCOES.map((lei) => (
                    <option key={lei} value={lei}>
                      {lei}
                    </option>
                  ))}
                </select>
              </div>

              {/* Banca */}
              <div>
                <label className={CLASSE_LABEL}>Banca</label>
                <select
                  name="banca"
                  defaultValue={filtros.banca ?? ""}
                  className={CLASSE_SELECT}
                  data-faceta="banca"
                >
                  <option value="">Todas as bancas</option>
                  {(opcoes.banca ?? []).map((opt) => (
                    <option key={opt.valor} value={opt.valor}>
                      {opt.valor} ({opt.total})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Linha 2: Ano, Instituição, Cargo, Nível */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Ano */}
              <div>
                <label className={CLASSE_LABEL}>Ano</label>
                <select
                  name="ano"
                  defaultValue={filtros.ano ? String(filtros.ano) : ""}
                  className={CLASSE_SELECT}
                  data-faceta="ano"
                >
                  <option value="">Todos os anos</option>
                  {(opcoes.ano ?? []).map((opt) => (
                    <option key={opt.valor} value={opt.valor}>
                      {opt.valor} ({opt.total})
                    </option>
                  ))}
                </select>
              </div>

              {/* Instituição / Órgão */}
              <div>
                <label className={CLASSE_LABEL}>Instituição</label>
                <select
                  name="orgao"
                  defaultValue={filtros.orgao ?? ""}
                  className={CLASSE_SELECT}
                  data-faceta="orgao"
                >
                  <option value="">Todas as instituições</option>
                  {(opcoes.orgao ?? []).map((opt) => (
                    <option key={opt.valor} value={opt.valor}>
                      {opt.valor} ({opt.total})
                    </option>
                  ))}
                </select>
              </div>

              {/* Cargo */}
              <div>
                <label className={CLASSE_LABEL}>Cargo</label>
                <select
                  name="cargo"
                  defaultValue={filtros.cargo ?? ""}
                  className={CLASSE_SELECT}
                  data-faceta="cargo"
                >
                  <option value="">Todos os cargos</option>
                  {(opcoes.cargo ?? []).map((opt) => (
                    <option key={opt.valor} value={opt.valor}>
                      {opt.valor} ({opt.total})
                    </option>
                  ))}
                </select>
              </div>

              {/* Nível */}
              <div>
                <label className={CLASSE_LABEL}>Nível</label>
                <select
                  name="nivel"
                  defaultValue=""
                  className={CLASSE_SELECT}
                  data-faceta="nivel"
                >
                  <option value="">Todos os níveis</option>
                  {NIVEIS_OPCOES.map((niv) => (
                    <option key={niv} value={niv}>
                      {niv}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 5. FILTROS AVANÇADOS (4 DROPDOWNS: 1 LINHA DE 4) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-[#005c53]" />
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Filtros avançados
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Dificuldade */}
              <div>
                <label className={CLASSE_LABEL}>Dificuldade</label>
                <select
                  name="dificuldade"
                  defaultValue=""
                  className={CLASSE_SELECT}
                  data-faceta="dificuldade"
                >
                  <option value="">Todas as dificuldades</option>
                  {DIFICULDADE_OPCOES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Modalidade */}
              <div>
                <label className={CLASSE_LABEL}>Modalidade</label>
                <select
                  name="tipo"
                  defaultValue={filtros.tipo ?? ""}
                  className={CLASSE_SELECT}
                  data-faceta="tipo"
                >
                  <option value="">Todas as modalidades</option>
                  <option value="multipla_escolha">Múltipla Escolha</option>
                  <option value="certo_errado">Certo / Errado</option>
                </select>
              </div>

              {/* Área de Formação */}
              <div>
                <label className={CLASSE_LABEL}>Área de Formação</label>
                <select
                  name="area_formacao"
                  defaultValue=""
                  className={CLASSE_SELECT}
                  data-faceta="area_formacao"
                >
                  <option value="">Todas as áreas</option>
                  {AREA_FORMACAO_OPCOES.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>

              {/* Área de Atuação */}
              <div>
                <label className={CLASSE_LABEL}>Área de Atuação</label>
                <select
                  name="area_atuacao"
                  defaultValue=""
                  className={CLASSE_SELECT}
                  data-faceta="area_atuacao"
                >
                  <option value="">Todas as áreas</option>
                  {AREA_ATUACAO_OPCOES.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 6. CHECKBOXES (2 COLUNAS: EXCLUIR QUESTÕES / QUESTÕES COM) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Coluna 1: Excluir questões */}
            <div className="space-y-2">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Excluir questões
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      name="desatualizadas"
                      value="excluir"
                      defaultChecked
                      className="h-4 w-4 rounded border-slate-300 accent-[#005c53] focus:ring-[#005c53]"
                    />
                    <span>Desatualizadas</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      name="anuladas"
                      value="excluir"
                      defaultChecked={filtros.anuladas === "excluir" || filtros.anuladas === null}
                      className="h-4 w-4 rounded border-slate-300 accent-[#005c53] focus:ring-[#005c53]"
                      data-refinamento="anuladas"
                    />
                    <span>Anuladas</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      name="ineditas"
                      value="excluir"
                      defaultChecked={filtros.ineditas === "excluir"}
                      className="h-4 w-4 rounded border-slate-300 accent-[#005c53] focus:ring-[#005c53]"
                      data-refinamento="ineditas"
                    />
                    <span>Inéditas</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      name="excluir_simulados"
                      value="1"
                      className="h-4 w-4 rounded border-slate-300 accent-[#005c53] focus:ring-[#005c53]"
                    />
                    <span>Dos meus simulados</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      name="excluir_cadernos"
                      value="1"
                      className="h-4 w-4 rounded border-slate-300 accent-[#005c53] focus:ring-[#005c53]"
                    />
                    <span>Dos meus cadernos</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Coluna 2: Questões com */}
            <div className="space-y-2">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Questões com
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      name="com_gabarito_comentado"
                      value="1"
                      className="h-4 w-4 rounded border-slate-300 accent-[#005c53] focus:ring-[#005c53]"
                    />
                    <span>Gabarito comentado</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      name="com_meus_comentarios"
                      value="1"
                      className="h-4 w-4 rounded border-slate-300 accent-[#005c53] focus:ring-[#005c53]"
                    />
                    <span>Meus comentários</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      name="com_comentarios"
                      value="1"
                      className="h-4 w-4 rounded border-slate-300 accent-[#005c53] focus:ring-[#005c53]"
                    />
                    <span>Comentários</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 7. BARRA DE AÇÃO INFERIOR */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <Link
              href={acao}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Limpar</span>
            </Link>

            <Button
              type="submit"
              className="bg-[#005c53] hover:bg-[#004741] text-white font-bold text-xs sm:text-sm px-7 py-2.5 rounded-lg shadow-sm transition-all"
            >
              Buscar questões
            </Button>
          </div>
        </div>

        {/* ================= CARD LATERAL: FILTROS APLICADOS (DIREITA: ~25%) ================= */}
        <aside className="lg:col-span-3 p-5 sm:p-6 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Filtros aplicados
            </h4>

            {/* Minhas questões */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                Minhas questões
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-medium text-slate-800 dark:text-slate-200">
                <span>{statusQuestao === "todas" ? "Todas" : statusQuestao}</span>
                <span className="text-slate-400 text-xs">⊗</span>
              </span>
            </div>

            {/* Lista de chips aplicados */}
            <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                Filtros ativos ({chips.length})
              </span>
              {chips.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Nenhum filtro de busca ativo
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <span
                      key={chip.chave}
                      data-chip={chip.chave}
                      className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/60 px-3 py-1 text-xs text-teal-900 dark:text-teal-200"
                    >
                      <span className="font-semibold text-teal-700 dark:text-teal-400">
                        {chip.rotulo}:
                      </span>
                      <span>{chip.valor}</span>
                      <Link
                        href={hrefSem(chip.chave)}
                        aria-label={`Remover filtro de ${chip.rotulo.toLowerCase()}`}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-teal-200/50 dark:hover:bg-teal-800 text-teal-700 dark:text-teal-300 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </Link>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Seletor de itens por página */}
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800">
              <label className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                <span>Exibir por página:</span>
                <select
                  name="por"
                  defaultValue={porPagina === TAMANHO_DE_PAGINA ? "" : String(porPagina)}
                  className="h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-[#005c53] focus:ring-1 focus:ring-[#005c53]"
                >
                  {TAMANHOS_DE_PAGINA.map((n) => (
                    <option key={n} value={n === TAMANHO_DE_PAGINA ? "" : String(n)}>
                      {n} questões
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Ações da lateral */}
            <div className="pt-3 space-y-2 border-t border-slate-200/60 dark:border-slate-800">
              <Button
                type="submit"
                className="w-full bg-[#005c53] hover:bg-[#004741] text-white font-bold text-xs py-2 rounded-lg shadow-2xs transition-all"
              >
                Buscar questões
              </Button>

              {!filtroEhPadrao(filtros) && (
                <Link
                  href={acao}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Limpar todos os filtros
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}

export default BarraFiltros;
