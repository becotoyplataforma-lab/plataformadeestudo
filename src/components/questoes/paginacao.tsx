import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  janelaDePaginas,
  queryDePagina,
  type FiltrosCaderno,
  type Pagina,
} from "@/lib/questoes/cadernos";
import { rotasQuestoes } from "@/lib/questoes/rotas";

/**
 * Paginação do caderno — links de servidor, estado na URL.
 *
 * Cada botão é um `<Link>` que reconstrói a query com `queryDePagina`, então o
 * `?assunto=Pontuação&page=2` compartilhado abre exatamente na página 2 do
 * assunto filtrado. Sem estado de cliente, sem requisição: a lista já é
 * renderizada no servidor e cortada por `fatiarPagina`.
 */

const CLASSE_BOTAO =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm transition-colors";
const CLASSE_ATIVA = "border-primary bg-primary/15 text-primary font-semibold";
const CLASSE_PADRAO = "border-border text-muted-foreground hover:bg-accent hover:text-foreground";
const CLASSE_DESABILITADO = "pointer-events-none border-border/50 text-muted-foreground/40";

export interface PaginacaoProps {
  slug: string;
  filtros: FiltrosCaderno;
  pagina: Pagina;
}

export function Paginacao({ slug, filtros, pagina }: PaginacaoProps) {
  if (pagina.totalPaginas <= 1) return null;

  const href = (p: number) =>
    rotasQuestoes.cadernoComFiltros(
      slug,
      queryDePagina(filtros, { ...pagina, atual: p })
    );
  const paginas = janelaDePaginas(pagina.atual, pagina.totalPaginas);

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Paginação">
      {pagina.atual > 1 ? (
        <Link href={href(pagina.atual - 1)} className={`${CLASSE_BOTAO} ${CLASSE_PADRAO}`} rel="prev">
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Link>
      ) : (
        <span className={`${CLASSE_BOTAO} ${CLASSE_DESABILITADO}`} aria-hidden="true">
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </span>
      )}

      {paginas.map((p, i) => {
        const anterior = paginas[i - 1];
        const buraco = anterior !== undefined && p - anterior > 1;
        return (
          <span key={p} className="flex items-center gap-1.5">
            {buraco && (
              <span className="text-sm text-muted-foreground" aria-hidden="true">
                …
              </span>
            )}
            {p === pagina.atual ? (
              <span
                aria-current="page"
                className={`${CLASSE_BOTAO} ${CLASSE_ATIVA}`}
                data-pagina={p}
              >
                {p}
              </span>
            ) : (
              <Link href={href(p)} className={`${CLASSE_BOTAO} ${CLASSE_PADRAO}`} data-pagina={p}>
                {p}
              </Link>
            )}
          </span>
        );
      })}

      {pagina.atual < pagina.totalPaginas ? (
        <Link
          href={href(pagina.atual + 1)}
          className={`${CLASSE_BOTAO} ${CLASSE_PADRAO}`}
          rel="next"
        >
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={`${CLASSE_BOTAO} ${CLASSE_DESABILITADO}`} aria-hidden="true">
          Próxima
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}

export default Paginacao;
