"use client";

import * as React from "react";
import Link from "next/link";
import {
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
  "h-10 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 text-xs text-slate-200 shadow-2xs transition-all focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30";
const CLASSE_LABEL = "block text-[11px] font-semibold text-slate-300 mb-1";

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
      className="rounded-2xl border border-white/10 bg-slate-900 shadow-xl overflow-hidden"
      aria-label="Filtros de questões"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
        {/* ================= COLUNA PRINCIPAL DE FILTROS (ESQUERDA: ~75%) ================= */}
        <div className="lg:col-span-9 p-5 sm:p-6 space-y-5">
          {/* 1. SUB-TABS: FILTRO CLÁSSICO / FILTRO NOVO */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <button
              type="button"
              onClick={() => setSubAba("classico")}
              className={`rounded-t-xl px-5 py-2 text-xs sm:text-sm font-semibold transition-all ${
                subAba === "classico"
                  ? "border-b-2 border-cyan-400 bg-cyan-500/10 text-cyan-300"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Filtro clássico
            </button>
            <button
              type="button"
              onClick={() => setSubAba("novo")}
              className={`rounded-t-xl px-5 py-2 text-xs sm:text-sm font-medium flex items-center gap-2 transition-all ${
                subAba === "novo"
                  ? "border-b-2 border-cyan-400 bg-cyan-500/10 text-cyan-300"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>Filtro novo</span>
              <span className="bg-cyan-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Novidade
              </span>
            </button>
          </div>

          {/* 2. STATUS PILLS ("Minhas questões") */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
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
                        ? "bg-cyan-600 text-white shadow-sm shadow-cyan-950"
                        : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
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
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all shadow-2xs"
              data-faceta="palavra"
            />
          </div>

          {/* 4. FILTROS MAIS USADOS (8 DROPDOWNS: 2 LINHAS DE 4) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
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
              <Filter className="h-3.5 w-3.5 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-white/10">
            {/* Coluna 1: Excluir questões */}
            <div className="space-y-2">
              <span className="block text-xs font-bold text-slate-300">
                Excluir questões
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      name="desatualizadas"
                      value="excluir"
                      defaultChecked
                      className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-cyan-500 focus:ring-cyan-500"
                    />
                    <span>Desatualizadas</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      name="anuladas"
                      value="excluir"
                      defaultChecked={filtros.anuladas === "excluir" || filtros.anuladas === null}
                      className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-cyan-500 focus:ring-cyan-500"
                      data-refinamento="anuladas"
                    />
                    <span>Anuladas</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      name="ineditas"
                      value="excluir"
                      defaultChecked={filtros.ineditas === "excluir"}
                      className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-cyan-500 focus:ring-cyan-500"
                      data-refinamento="ineditas"
                    />
                    <span>Inéditas</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      name="excluir_simulados"
                      value="1"
                      className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-cyan-500 focus:ring-cyan-500"
                    />
                    <span>Dos meus simulados</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      name="excluir_cadernos"
                      value="1"
                      className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-cyan-500 focus:ring-cyan-500"
                    />
                    <span>Dos meus cadernos</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Coluna 2: Questões com */}
            <div className="space-y-2">
              <span className="block text-xs font-bold text-slate-300">
                Questões com
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      name="com_gabarito_comentado"
                      value="1"
                      className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-cyan-500 focus:ring-cyan-500"
                    />
                    <span>Gabarito comentado</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      name="com_meus_comentarios"
                      value="1"
                      className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-cyan-500 focus:ring-cyan-500"
                    />
                    <span>Meus comentários</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      name="com_comentarios"
                      value="1"
                      className="h-4 w-4 rounded border-white/20 bg-slate-950 accent-cyan-500 focus:ring-cyan-500"
                    />
                    <span>Comentários</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 7. BARRA DE AÇÃO INFERIOR */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <Link
              href={acao}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Limpar</span>
            </Link>

            <Button
              type="submit"
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm px-7 py-2.5 rounded-xl shadow-md shadow-cyan-950 transition-all"
            >
              Buscar questões
            </Button>
          </div>
        </div>

        {/* ================= CARD LATERAL: FILTROS APLICADOS (DIREITA: ~25%) ================= */}
        <aside className="lg:col-span-3 p-5 sm:p-6 bg-slate-950/40">
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Filtros aplicados
            </h4>

            {/* Minhas questões */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-400 block">
                Minhas questões
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
                <span>{statusQuestao === "todas" ? "Todas" : statusQuestao}</span>
                <span className="text-slate-400 text-xs">⊗</span>
              </span>
            </div>

            {/* Lista de chips aplicados */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <span className="text-[11px] font-medium text-slate-400 block">
                Filtros ativos ({chips.length})
              </span>
              {chips.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  Nenhum filtro de busca ativo
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <span
                      key={chip.chave}
                      data-chip={chip.chave}
                      className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/60 px-3 py-1 text-xs text-cyan-200"
                    >
                      <span className="font-semibold text-cyan-400">
                        {chip.rotulo}:
                      </span>
                      <span>{chip.valor}</span>
                      <Link
                        href={hrefSem(chip.chave)}
                        aria-label={`Remover filtro de ${chip.rotulo.toLowerCase()}`}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-cyan-900 text-cyan-400 hover:text-white transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </Link>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Seletor de itens por página */}
            <div className="pt-3 border-t border-white/10">
              <label className="flex items-center justify-between text-xs font-medium text-slate-400">
                <span>Exibir por página:</span>
                <select
                  name="por"
                  defaultValue={porPagina === TAMANHO_DE_PAGINA ? "" : String(porPagina)}
                  className="h-8 rounded-lg border border-white/10 bg-slate-950 px-2.5 text-xs font-semibold text-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
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
            <div className="pt-3 space-y-2 border-t border-white/10">
              <Button
                type="submit"
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs py-2 rounded-xl shadow-md shadow-cyan-950 transition-all"
              >
                Buscar questões
              </Button>

              {!filtroEhPadrao(filtros) && (
                <Link
                  href={acao}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 py-1.5 text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
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
