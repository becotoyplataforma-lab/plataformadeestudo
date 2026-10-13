import { Button } from "@/components/ui/button";
import type { FiltrosCaderno, OpcaoFaceta } from "@/lib/questoes/cadernos";
import { filtroEstaVazio, rotuloDaTag } from "@/lib/questoes/cadernos";

/**
 * Barra de filtros do caderno — formulário GET servidor, sem ilha de cliente.
 *
 * `<form method="get">` com `<select>` nativo de propósito: o filtro continua
 * sendo a URL (compartilhável, indexável pelo histórico, vivo no botão voltar),
 * a página continua renderizada no servidor, e nada aqui precisa de JavaScript
 * nem de endpoint. Um Radix `Select` dentro de client component quebraria isso
 * e ainda arrastaria hidratação para cada lista de 20 questões.
 *
 * As opções vêm do lote (`contagemDaFaceta`), nunca de lista fixa: bancas são
 * 150 valores observados e o material não declara banca em boa parte das
 * questões. O total ao lado do rótulo é medido, não chutado.
 *
 * Trocar filtro devolve à página 1 porque o `page` não participa do formulário:
 * ao submeter, a query que nasce é a dos campos, e a URL limpa é a canônica da
 * primeira página.
 */

export interface BarraFiltrosProps {
  /** Rota do caderno, sem query — vira o `action` do formulário. */
  acao: string;
  filtros: FiltrosCaderno;
  opcoes: {
    disciplina: OpcaoFaceta[];
    assunto: OpcaoFaceta[];
    banca: OpcaoFaceta[];
    ano: OpcaoFaceta[];
    tipo: OpcaoFaceta[];
  };
}

const CLASSE_SELECT =
  "h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";
const CLASSE_ROTULO = "text-xs font-medium text-muted-foreground";

function Campo({
  nome,
  rotulo,
  todos,
  valores,
  atual,
}: {
  nome: keyof FiltrosCaderno;
  rotulo: string;
  todos: string;
  valores: OpcaoFaceta[];
  atual: string | null;
}) {
  return (
    <label className="space-y-1">
      <span className={CLASSE_ROTULO}>{rotulo}</span>
      <select name={nome} defaultValue={atual ?? ""} className={CLASSE_SELECT}>
        <option value="">{todos}</option>
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

export function BarraFiltros({ acao, filtros, opcoes }: BarraFiltrosProps) {
  return (
    <form
      method="get"
      action={acao}
      className="rounded-xl border border-border bg-card p-4"
      aria-label="Filtros de questões"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Campo
          nome="disciplina"
          rotulo="Disciplina"
          todos="Todas as disciplinas"
          valores={opcoes.disciplina}
          atual={filtros.disciplina}
        />
        <Campo
          nome="assunto"
          rotulo="Assunto"
          todos="Todos os assuntos"
          valores={opcoes.assunto}
          atual={filtros.assunto}
        />
        <Campo
          nome="banca"
          rotulo="Banca"
          todos="Todas as bancas"
          valores={opcoes.banca}
          atual={filtros.banca}
        />
        <Campo
          nome="ano"
          rotulo="Ano"
          todos="Todos os anos"
          valores={opcoes.ano}
          atual={filtros.ano === null ? null : String(filtros.ano)}
        />
        <Campo
          nome="tipo"
          rotulo="Modalidade"
          todos="Todas as modalidades"
          valores={opcoes.tipo}
          atual={filtros.tipo}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="gabarito"
            value="confiavel"
            defaultChecked={filtros.gabarito === "confiavel"}
            className="h-4 w-4 rounded border-border bg-background accent-primary"
          />
          Só com gabarito confiável
        </label>

        <div className="ml-auto flex items-center gap-2">
          {!filtroEstaVazio(filtros) && (
            <a
              href={acao}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Limpar filtros
            </a>
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
