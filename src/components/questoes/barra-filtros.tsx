import Link from "next/link";
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
  queryDeFiltros,
  rotuloDaTag,
  semAChave,
  type AbaComTotal,
  type ChaveDeContagem,
  type FiltrosCaderno,
  type OpcaoFaceta,
  type RefinamentosCaderno,
} from "@/lib/questoes/cadernos";

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
    </label>
  );
}

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
            <input
              type="search"
              name="palavra"
              defaultValue={filtros.palavra ?? ""}
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
  );
}

export default BarraFiltros;
