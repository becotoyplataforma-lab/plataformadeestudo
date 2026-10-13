import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CADERNOS } from "@/lib/questoes/cadernos";
import { montarListagem } from "@/lib/questoes/listagem-caderno";
import { rotasQuestoes } from "@/lib/questoes/rotas";

export const metadata: Metadata = {
  title: "Questões",
  description: "Banco de questões para concursos públicos.",
};

/**
 * `/questoes` — a porta de entrada do domínio de questões.
 *
 * Com um caderno no catálogo, esta rota é o próprio caderno: redirecionar
 * preserva um único canônico (o da matéria) em vez de renderizar o mesmo acervo
 * em duas URLs. Com mais de um, a página vira índice de cadernos com a contagem
 * real de cada um — e a contagem vem do lote, não de número decorado.
 *
 * O que esta rota NÃO faz mais: listar `questions`. Foi assim que fixtura de
 * teste de integração ("E2E 58f07a7b", "Qual é a pergunta?") apareceu para o
 * aluno como conteúdo de prova. O banco publicado tem rota própria
 * (`/questoes/banco`) e as fixturas estão excluídas da leitura.
 */
export default async function QuestoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const busca = await searchParams;

  if (CADERNOS.length === 1) {
    const unico = CADERNOS[0]!;
    const sp = new URLSearchParams();
    for (const [chave, valor] of Object.entries(busca)) {
      const texto = Array.isArray(valor) ? valor[0] : valor;
      if (typeof texto === "string" && texto.length > 0) sp.set(chave, texto);
    }
    const query = sp.toString();
    redirect(
      rotasQuestoes.caderno(unico.slug) + (query.length > 0 ? `?${query}` : "")
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Questões</h1>
        <p className="text-sm text-muted-foreground">
          Escolha a matéria para abrir o caderno. A proveniência do material é
          metadado de filtro, não nome de rota.
        </p>
      </header>

      <ul className="space-y-2">
        {CADERNOS.map((caderno) => {
          const listagem = montarListagem(caderno, {});
          return (
            <li key={caderno.slug}>
              <Link
                href={rotasQuestoes.caderno(caderno.slug)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{caderno.titulo}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {caderno.subtitulo}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {listagem.acervo.itens.length} questões
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted-foreground">
        O que já foi importado e publicado está em{" "}
        <Link href={rotasQuestoes.banco()} className="underline">
          questões do banco
        </Link>
        .
      </p>
    </div>
  );
}

