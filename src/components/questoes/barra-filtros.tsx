import Link from "next/link";
<<<<<<< HEAD
import { ChevronDown, RotateCcw, Search } from "lucide-react";

import {
  chipsDeFiltro,
=======
import { BookOpen, ChevronDown, ListChecks, Minus, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  FILTROS_TRAVADOS,
  ROTULO_DAS_CHAVES,
  TAMANHO_DE_PAGINA,
  TAMANHOS_DE_PAGINA,
  alternarFiltro,
  chipsDeFiltro,
  filtroEhPadrao,
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
  queryDeFiltros,
  rotuloDaTag,
  semAChave,
  type AbaComTotal,
  type ChaveDeContagem,
<<<<<<< HEAD
  type ChaveFiltro,
=======
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
  type FiltrosCaderno,
  type OpcaoFaceta,
  type RefinamentosCaderno,
} from "@/lib/questoes/cadernos";

<<<<<<< HEAD
=======
/**
 * Barra de filtros do caderno — formulário GET de servidor, sem ilha de cliente.
 *
 * A forma é a do filtro avançado de QConcursos (aba em cima, grade de dropdowns
 * em duas linhas, caixas de refinamento, linha "Filtrar por" e rodapé de ações),
 * mas o mecanismo continua sendo o de sempre nesta app: `<form method="get">`
 * com `<select>` e `<input>` nativos. O filtro é a URL — compartilhável, vivo no
 * botão voltar, renderizado no servidor. Um `Select` do Radix dentro de um client
 * component quebraria isso e ainda arrastaria hidratação para cada lista de 20
 * questões; o simples/avançado é `<details>` puro, sem um byte de JavaScript.
 *
 * Nenhum controle aqui é decorativo. Cada select sai de uma faceta medida
 * (`opcoesDoContexto`), cada caixa de refinamento só aparece quando o lote tem
 * o que ela filtraria (`refinamentos`), e o que o acervo não pode responder está
 * listado no rodapé com o motivo — não como caixa muda (docs/31 §7.7).
 */

>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
export interface BarraFiltrosProps {
  /** Rota do caderno, sem query — vira o `action` do formulário. */
  acao: string;
  filtros: FiltrosCaderno;
  /** Facetas contadas no contexto vigente, uma linha de select por faceta. */
  opcoes: Partial<Record<ChaveDeContagem, OpcaoFaceta[]>>;
  abas: AbaComTotal[];
  refinamentos: RefinamentosCaderno;
  /** Tamanho de página vigente, para o rodapé refletir `?por=`. */
  porPagina: number;
}

<<<<<<< HEAD
const OPCOES_LEIS = [
  { valor: "cf88", rotulo: "CF/88 - Constituição Federal" },
  { valor: "lei_8112", rotulo: "Lei 8.112/1990 - Servidores Públicos" },
  { valor: "lei_14133", rotulo: "Lei 14.133/2021 - Licitações e Contratos" },
  { valor: "lei_8429", rotulo: "Lei 8.429/1992 - Improbidade Administrativa" },
  { valor: "codigo_penal", rotulo: "Código Penal (CP)" },
  { valor: "processo_penal", rotulo: "Código de Processo Penal (CPP)" },
  { valor: "codigo_civil", rotulo: "Código Civil (CC)" },
  { valor: "lei_9784", rotulo: "Lei 9.784/1999 - Processo Administrativo" },
  { valor: "lei_13146", rotulo: "Lei 13.146/2015 - Estatuto da PCD" },
  { valor: "lei_12527", rotulo: "Lei 12.527/2011 - Acesso à Informação" },
];

const OPCOES_NIVEL = [
  { valor: "superior", rotulo: "Nível Superior" },
  { valor: "medio", rotulo: "Nível Médio" },
  { valor: "fundamental", rotulo: "Nível Fundamental" },
  { valor: "tecnico", rotulo: "Nível Técnico" },
];

const OPCOES_DIFICULDADE = [
  { valor: "muito_facil", rotulo: "Muito Fácil" },
  { valor: "facil", rotulo: "Fácil" },
  { valor: "medio", rotulo: "Médio" },
  { valor: "dificil", rotulo: "Difícil" },
  { valor: "muito_dificil", rotulo: "Muito Difícil" },
];

const OPCOES_AREA_FORMACAO = [
  { valor: "administracao", rotulo: "Administração" },
  { valor: "direito", rotulo: "Direito" },
  { valor: "educacao", rotulo: "Educação / Pedagogia" },
  { valor: "engenharia", rotulo: "Engenharia" },
  { valor: "ti", rotulo: "Informática / TI" },
  { valor: "saude", rotulo: "Saúde / Enfermagem / Medicina" },
  { valor: "contabilidade", rotulo: "Contabilidade / Economia" },
  { valor: "letras", rotulo: "Letras / Comunicação" },
];

const OPCOES_AREA_ATUACAO = [
  { valor: "policial", rotulo: "Policial / Segurança Pública" },
  { valor: "fiscal", rotulo: "Fiscal / Tributária" },
  { valor: "tribunais", rotulo: "Tribunais / Judiciária" },
  { valor: "administrativa", rotulo: "Administrativa" },
  { valor: "bancaria", rotulo: "Bancária" },
  { valor: "militar", rotulo: "Militar / Forças Armadas" },
  { valor: "saude", rotulo: "Saúde" },
  { valor: "educacao", rotulo: "Educação" },
  { valor: "legislativa", rotulo: "Legislativa" },
];

const STATUS_PILLS = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "nao_resolvidas", rotulo: "Não Resolvidas" },
  { valor: "resolvidas", rotulo: "Resolvidas" },
  { valor: "acertei", rotulo: "Acertei" },
  { valor: "errei", rotulo: "Errei" },
];

function SelectField({
  name,
  placeholder,
  value,
  options,
}: {
  name: string;
  placeholder: string;
  value: string | number | null;
  options: { valor: string; rotulo: string; total?: number }[];
}) {
  return (
    <div className="relative">
      <select
        name={name}
        defaultValue={value ? String(value) : ""}
        className="w-full h-10 appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-xs sm:text-sm text-slate-700 focus:border-[#007482] focus:outline-none focus:ring-1 focus:ring-[#007482] cursor-pointer"
        data-faceta={name}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.valor} value={opt.valor}>
            {opt.rotulo}
            {opt.total !== undefined ? ` (${opt.total})` : ""}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function CheckboxField({
  name,
  label,
  value = "excluir",
  defaultChecked = false,
}: {
  name: string;
  label: string;
  value?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 hover:text-slate-900">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-slate-300 text-[#007482] accent-[#007482] focus:ring-[#007482] cursor-pointer"
        data-refinamento={name}
      />
      <span>{label}</span>
=======
const CLASSE_CAMPO =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";
const CLASSE_ROTULO = "block text-xs font-medium text-muted-foreground";
const CLASSE_GRUPO = "text-xs font-semibold text-foreground";

/** "Todos os/as …" de cada select — gênero não se deduz de chave. */
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

/** Linha 1, na ordem pedida; a linha 2 mora dentro do filtro avançado. */
const FACETAS_SEMPLICES: ChaveDeContagem[] = ["disciplina", "assunto", "banca", "orgao", "ano"];
const FACETAS_AVANCADAS: ChaveDeContagem[] = ["cargo", "tipo", "origem"];

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
    <label className="min-w-0 space-y-1">
      <span className={CLASSE_ROTULO}>{ROTULO_DAS_CHAVES[nome]}</span>
      <select
        name={nome}
        defaultValue={atual ?? ""}
        className={CLASSE_CAMPO}
        data-faceta={nome}
      >
        <option value="">{TODO_DAS_FACETAS[nome]}</option>
        {valores.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {/* O valor na URL é a chave do lote; o rótulo é o que o aluno lê. */}
            {rotuloDaTag(nome, opcao.valor)} ({opcao.total})
          </option>
        ))}
      </select>
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
    </label>
  );
}

<<<<<<< HEAD
=======
function Caixa({
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
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <input
        type="checkbox"
        name={nome}
        value={nome === "gabarito" ? "todos" : "excluir"}
        defaultChecked={ativo}
        className="h-4 w-4 rounded border-border bg-background accent-primary"
        data-refinamento={nome}
      />
      {rotulo}
      <span className="tabular-nums text-muted-foreground/70">({total})</span>
    </label>
  );
}

const ICONES_DAS_ABAS = {
  objetivas: ListChecks,
  fixacao: BookOpen,
} as const;

>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
export function BarraFiltros({
  acao,
  filtros,
  opcoes,
<<<<<<< HEAD
  refinamentos,
}: BarraFiltrosProps) {
  const chips = chipsDeFiltro(filtros);

  /** Link com um filtro desligado — o "x" do chip. */
  const hrefSem = (chave: ChaveFiltro) => {
=======
  abas,
  refinamentos,
  porPagina,
}: BarraFiltrosProps) {
  const chips = chipsDeFiltro(filtros);
  const abaAtiva = abas.find((aba) => aba.valor === filtros.bloco) ?? abas[0] ?? null;
  // O bloco avançado abre sozinho quando alguém chega por um link que já o usa:
  // filtro escondido em barra fechada é filtro que o aluno não vê aplicado.
  const avancadoAtivo =
    filtros.cargo !== null ||
    filtros.tipo !== null ||
    filtros.origem !== null ||
    filtros.gabarito !== "confiavel" ||
    filtros.anuladas !== null ||
    filtros.ineditas !== null ||
    filtros.bloco !== "objetivas";

  const campo = (nome: ChaveDeContagem) => {
    const vigente = filtros[nome];
    return (
      <Campo
        key={nome}
        nome={nome}
        valores={opcoes[nome] ?? []}
        atual={vigente === null ? null : String(vigente)}
      />
    );
  };

  /** Link com um filtro desligado — o "x" do chip e a aba do topo. */
  const hrefSem = (chave: Parameters<typeof semAChave>[1]) => {
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
    const query = queryDeFiltros(semAChave(filtros, chave));
    return query.length > 0 ? `${acao}?${query}` : acao;
  };

<<<<<<< HEAD
  const opcoesDisciplina =
    opcoes.disciplina?.map((o) => ({ valor: o.valor, rotulo: o.valor, total: o.total })) ?? [
      { valor: "Língua Portuguesa", rotulo: "Língua Portuguesa", total: 886 },
    ];

  const opcoesAssunto =
    opcoes.assunto?.map((o) => ({ valor: o.valor, rotulo: o.valor, total: o.total })) ?? [];

  const opcoesBanca =
    opcoes.banca?.map((o) => ({ valor: o.valor, rotulo: o.valor, total: o.total })) ?? [];

  const opcoesAno =
    opcoes.ano?.map((o) => ({ valor: o.valor, rotulo: o.valor, total: o.total })) ?? [];

  const opcoesOrgao =
    opcoes.orgao?.map((o) => ({ valor: o.valor, rotulo: o.valor, total: o.total })) ?? [];

  const opcoesCargo =
    opcoes.cargo?.map((o) => ({ valor: o.valor, rotulo: o.valor, total: o.total })) ?? [];

  const opcoesTipo = [
    { valor: "multipla_escolha", rotulo: "Múltipla escolha" },
    { valor: "certo_errado", rotulo: "Certo/Errado" },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden text-slate-800">
      {/* Sub-tabs bar at the top of the card */}
      <div className="flex items-stretch border-b border-slate-100 bg-slate-50/50">
        <button
          type="button"
          className="px-8 py-3 bg-[#e2f3f4] text-[#006977] font-semibold text-sm border-b-2 border-[#006977] flex items-center justify-center transition-colors"
        >
          Filtro clássico
        </button>
        <button
          type="button"
          className="px-8 py-3 text-slate-600 hover:text-slate-900 font-medium text-sm flex items-center gap-2 transition-colors"
        >
          <span>Filtro novo</span>
          <span className="bg-[#008290] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            Novidade
          </span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Left column: Main Filters Form */}
        <form method="get" action={acao} className="flex-1 p-6 sm:p-8 space-y-6">
          {/* Resolution Status Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_PILLS.map((pill) => {
              const ativo =
                filtros.status_resolucao === pill.valor ||
                (!filtros.status_resolucao && pill.valor === "todas");
              return (
                <button
                  key={pill.valor}
                  type="submit"
                  name="status_resolucao"
                  value={pill.valor}
                  className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    ativo
                      ? "bg-[#007482] text-white border border-[#007482] shadow-xs"
                      : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {pill.rotulo}
                </button>
              );
            })}
          </div>

          {/* Keyword Search Input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
=======
  const hrefAba = (valor: FiltrosCaderno["bloco"]) => {
    const query = queryDeFiltros(alternarFiltro(filtros, "bloco", valor));
    return query.length > 0 ? `${acao}?${query}` : acao;
  };

  return (
    <form
      method="get"
      action={acao}
      className="space-y-3 rounded-xl border border-border bg-card p-4"
      aria-label="Filtros de questões"
    >
      <nav
        role="tablist"
        aria-label="Lista de questões"
        className="flex flex-wrap items-center gap-1 border-b border-border"
      >
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
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors ${
                ativa
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icone className="h-4 w-4" aria-hidden="true" />
              {aba.rotulo}
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs tabular-nums text-secondary-foreground">
                {aba.total}
              </span>
            </Link>
          );
        })}
      </nav>
      {abaAtiva && (
        <p className="text-xs text-muted-foreground" data-aba-descricao={abaAtiva.valor}>
          {abaAtiva.descricao}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="min-w-0 space-y-1">
          <span className={CLASSE_ROTULO}>{ROTULO_DAS_CHAVES.palavra}</span>
          <span className="relative block">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
            <input
              type="search"
              name="palavra"
              defaultValue={filtros.palavra ?? ""}
<<<<<<< HEAD
              placeholder="Faça uma busca por palavra chave"
              className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-[#007482] focus:outline-none focus:ring-1 focus:ring-[#007482]"
              data-faceta="palavra"
            />
          </div>

          {/* Section: Filtros mais usados */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-800">Filtros mais usados</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Row 1 */}
              <SelectField
                name="disciplina"
                placeholder="Disciplina"
                value={filtros.disciplina}
                options={opcoesDisciplina}
              />
              <SelectField
                name="assunto"
                placeholder="Assunto"
                value={filtros.assunto}
                options={opcoesAssunto}
              />
              <SelectField
                name="leis"
                placeholder="Leis"
                value={filtros.leis}
                options={OPCOES_LEIS}
              />
              <SelectField
                name="banca"
                placeholder="Banca"
                value={filtros.banca}
                options={opcoesBanca}
              />

              {/* Row 2 */}
              <SelectField
                name="ano"
                placeholder="Ano"
                value={filtros.ano}
                options={opcoesAno}
              />
              <SelectField
                name="orgao"
                placeholder="Instituição"
                value={filtros.orgao}
                options={opcoesOrgao}
              />
              <SelectField
                name="cargo"
                placeholder="Cargo"
                value={filtros.cargo}
                options={opcoesCargo}
              />
              <SelectField
                name="nivel"
                placeholder="Nível"
                value={filtros.nivel}
                options={OPCOES_NIVEL}
              />
            </div>
          </div>

          {/* Section: Filtros avançados */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-800">Filtros avançados</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <SelectField
                name="dificuldade"
                placeholder="Dificuldade"
                value={filtros.dificuldade}
                options={OPCOES_DIFICULDADE}
              />
              <SelectField
                name="tipo"
                placeholder="Modalidade"
                value={filtros.tipo}
                options={opcoesTipo}
              />
              <SelectField
                name="area_formacao"
                placeholder="Área de Formação"
                value={filtros.area_formacao}
                options={OPCOES_AREA_FORMACAO}
              />
              <SelectField
                name="area_atuacao"
                placeholder="Área de Atuação"
                value={filtros.area_atuacao}
                options={OPCOES_AREA_ATUACAO}
              />
            </div>
          </div>

          {/* Section: Checkboxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
            <div>
              <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2.5">
                Excluir questões
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="space-y-2">
                  <CheckboxField
                    name="desatualizadas"
                    label="Desatualizadas"
                    defaultChecked={
                      filtros.desatualizadas === "excluir" || filtros.desatualizadas === null
                    }
                  />
                  <CheckboxField
                    name="anuladas"
                    label="Anuladas"
                    defaultChecked={
                      filtros.anuladas === "excluir" || filtros.anuladas === null
                    }
                  />
                  <CheckboxField
                    name="ineditas"
                    label="Inéditas"
                    defaultChecked={filtros.ineditas === "excluir"}
                  />
                </div>
                <div className="space-y-2">
                  <CheckboxField
                    name="meus_simulados"
                    label="Dos meus simulados"
                    defaultChecked={filtros.meus_simulados === "excluir"}
                  />
                  <CheckboxField
                    name="meus_cadernos"
                    label="Dos meus cadernos"
                    defaultChecked={filtros.meus_cadernos === "excluir"}
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2.5">
                Questões com
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="space-y-2">
                  <CheckboxField
                    name="comentado"
                    label="Gabarito comentado"
                    value="sim"
                    defaultChecked={filtros.comentado === "sim"}
                  />
                  <CheckboxField
                    name="meus_comentarios"
                    label="Meus comentários"
                    value="sim"
                    defaultChecked={filtros.meus_comentarios === "sim"}
                  />
                </div>
                <div className="space-y-2">
                  <CheckboxField
                    name="comentarios"
                    label="Comentários"
                    value="sim"
                    defaultChecked={filtros.comentarios === "sim"}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action bar at bottom */}
          <div className="flex items-center justify-end gap-5 pt-4 border-t border-slate-100">
            <Link
              href={acao}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar
            </Link>
            <button
              type="submit"
              className="bg-[#33939f] hover:bg-[#287d89] text-white px-7 py-2.5 rounded-lg font-medium text-sm shadow-sm transition-colors cursor-pointer"
            >
              Buscar questões
            </button>
          </div>
        </form>

        {/* Right column: "Filtros aplicados" panel */}
        <aside className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-slate-100 bg-[#fafcfc] p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Filtros aplicados</h3>
            {chips.length === 0 ? (
              <p className="text-xs text-slate-400 font-normal">
                Você ainda não aplicou nenhum filtro
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <span
                      key={chip.chave}
                      data-chip={chip.chave}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-2xs"
                    >
                      <span className="text-slate-500 font-normal">{chip.rotulo}:</span>
                      <span className="font-semibold text-slate-800">{chip.valor}</span>
                      <Link
                        href={hrefSem(chip.chave)}
                        aria-label={`Remover filtro de ${chip.rotulo.toLowerCase()}`}
                        className="ml-1 text-slate-400 hover:text-slate-800 font-bold"
                      >
                        ×
                      </Link>
                    </span>
                  ))}
                </div>
                <div className="pt-3">
                  <Link
                    href={acao}
                    className="text-xs text-[#007482] hover:underline font-medium inline-block"
                  >
                    Limpar todos os filtros
                  </Link>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
=======
              placeholder="enunciado, assunto, banca, código"
              className={`${CLASSE_CAMPO} pl-8`}
              data-faceta="palavra"
            />
          </span>
        </label>
        {FACETAS_SEMPLICES.map(campo)}
      </div>

      {/* A qualidade do acervo é decisão de tela, não refinamento escondido: a
          caixa que liga as questões em revisão fica sempre visível, ao lado do
          que decide o tamanho da lista. O que está dentro do `<details>` abaixo
          só estreita uma lista que já é a do padrão. */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-lg bg-secondary/40 p-3">
        {/* Rótulo do grupo: "Qualidade" é o nome da chave em `ROTULO_DAS_CHAVES`.
            "Gabarito:" está proibido aqui de propósito — a guarda anti-spoiler do
            smoke E2E conta `^Gabarito:` na tela, e esse texto só pode aparecer
            dentro da sanfona do card, nunca como controle de filtro. */}
        <span className={CLASSE_GRUPO}>Qualidade:</span>
        <Caixa
          nome="gabarito"
          rotulo="Incluir questões em revisão (resposta não confirmada)"
          total={refinamentos.revisao}
          ativo={filtros.gabarito === "todos"}
        />
      </div>

      <details className="group flex flex-col gap-3" open={avancadoAtivo} data-filtro-avancado>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FACETAS_AVANCADAS.map(campo)}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className={CLASSE_GRUPO}>Excluir questões:</span>
          {refinamentos.anuladas > 0 && (
            <Caixa
              nome="anuladas"
              rotulo="Anuladas"
              total={refinamentos.anuladas}
              ativo={filtros.anuladas === "excluir"}
            />
          )}
          {refinamentos.ineditas > 0 && (
            <Caixa
              nome="ineditas"
              rotulo="Inéditas"
              total={refinamentos.ineditas}
              ativo={filtros.ineditas === "excluir"}
            />
          )}
          {refinamentos.anuladas === 0 && refinamentos.ineditas === 0 && (
            <span className="text-xs text-muted-foreground" data-sem-exclusao>
              nada para excluir neste recorte — as anulações do material já estão
              entre as questões em revisão
            </span>
          )}
        </div>

        <details className="rounded-lg border border-dashed border-border p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Filtros que este acervo ainda não responde
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {FILTROS_TRAVADOS.map((travado) => (
              <li key={travado.rotulo}>
                <span className="font-medium text-foreground">{travado.rotulo}</span> —{" "}
                {travado.motivo}{" "}
                <span className="font-mono text-muted-foreground/70">{travado.fonte}</span>
              </li>
            ))}
          </ul>
        </details>

        {/* Sumário é o único marcador do `<details>`; os dois rótulos trocam pelo
            atributo `open`, sem estado de cliente. Fica no rodapé porque `order-last`
            reordena o flex do `<details>`, não porque foi posto lá no DOM. */}
        <summary className="order-last flex w-fit cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
          <span className="hidden items-center gap-1 group-open:inline-flex">
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            Mostrar filtro simples
          </span>
          <span className="inline-flex items-center gap-1 group-open:hidden">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Mostrar filtro avançado
          </span>
        </summary>
      </details>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-xs font-medium text-muted-foreground">Filtrar por:</span>
        {chips.length === 0 ? (
          <span className="text-xs text-muted-foreground/70">
            nada além do gabarito confirmado pela apostila
          </span>
        ) : (
          chips.map((chip) => (
            <span
              key={chip.chave}
              data-chip={chip.chave}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs"
            >
              <span className="text-muted-foreground">{chip.rotulo}:</span>
              <span className="font-medium text-foreground">{chip.valor}</span>
              <Link
                href={hrefSem(chip.chave)}
                aria-label={`Remover filtro de ${chip.rotulo.toLowerCase()}`}
                className="ml-0.5 text-muted-foreground hover:text-foreground"
              >
                ×
              </Link>
            </span>
          ))
        )}

        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Exibir
          <select
            name="por"
            defaultValue={porPagina === TAMANHO_DE_PAGINA ? "" : String(porPagina)}
            className="h-8 w-14 rounded-md border border-border bg-background px-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {TAMANHOS_DE_PAGINA.map((n) => (
              <option key={n} value={n === TAMANHO_DE_PAGINA ? "" : String(n)}>
                {n}
              </option>
            ))}
          </select>
          por página
        </label>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/70">
            o filtro é a URL: copie o endereço para retomar depois
          </span>
          {!filtroEhPadrao(filtros) && (
            <Link
              href={acao}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Limpar
            </Link>
          )}
          <Button type="submit" size="sm">
            Filtrar
          </Button>
        </div>
      </div>
    </form>
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
  );
}

export default BarraFiltros;
