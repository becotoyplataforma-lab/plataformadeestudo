import Link from "next/link";

import { QuestaoCard } from "@/components/questoes/questao-card";
import { Badge } from "@/components/ui/badge";
import { carregarAula14, secoesAula14 } from "@/lib/questoes/dados-aula-14";
import { rotasPortugues } from "@/lib/questoes/rotas";

/**
 * Lista da Aula 14.
 *
 * Renderiza as questões **extraídas do PDF**, não exemplos escritos à mão: o
 * valor da página é justamente conferir item por item o que o extrator produziu.
 * Filtra por seção e por "só com gabarito confiável" pela query string, em
 * servidor, sem cliente pesado.
 */

export const metadata = {
  title: "Aula 14 — Questões de Língua Portuguesa",
  description: "Questões extraídas do material da Aula 14, em estado de revisão.",
};

const MAX_EM_LISTA = 60;

export default function Aula14Page({
  searchParams,
}: {
  searchParams: Promise<{ secao?: string; filtro?: string }>;
}) {
  return <Conteudo searchParams={searchParams} />;
}

async function Conteudo({
  searchParams,
}: {
  searchParams: Promise<{ secao?: string; filtro?: string }>;
}) {
  const { secao, filtro } = await searchParams;
  const carga = carregarAula14();

  if (!carga) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Dataset ainda não gerado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Rode o extrator para produzir{" "}
          <code className="font-mono">questoes_aula_14.json</code>. Esta página não
          mostra conteúdo de exemplo no lugar do material real.
        </p>
      </div>
    );
  }

  const secoes = secoesAula14();
  const secaoNum = secao ? Number(secao) : null;
  const soConfiavel = filtro === "gabarito";

  let itens = carga.questoes;
  if (secaoNum) itens = itens.filter((q) => q.secao === secaoNum);
  if (soConfiavel) itens = itens.filter((q) => !q.quarantined && q.gabarito);

  const visiveis = itens.slice(0, MAX_EM_LISTA);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Aula 14 · Língua Portuguesa</h1>
          <Badge variant="secondary">{carga.questoes.length} itens</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Material de <strong>CBM-PE (Soldado)</strong>. Tudo abaixo está em{" "}
          <code className="font-mono">em_revisao</code> e não publicado; gabarito vem do
          próprio PDF, e o que ele não diz fica marcado como pendência.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1.5">
        <Link
          href={rotasPortugues.questoes(14)}
          className={cnItem(!secaoNum && !soConfiavel)}
        >
          Todas
        </Link>
        <Link href={`?filtro=gabarito`} className={cnItem(soConfiavel)}>
          Só com gabarito
        </Link>
        {secoes.map((s) => (
          <Link
            key={s.secao}
            href={`?secao=${s.secao}`}
            className={cnItem(secaoNum === s.secao)}
            title={`${s.rotulo} — ${s.total} itens`}
          >
            {String(s.secao).padStart(2, "0")} · {s.rotulo.replace("Questões Comentadas - ", "").replace("Lista de Questões - ", "")}
          </Link>
        ))}
      </nav>

      {visiveis.map((q) => (
        <Link key={q.id_local} href={rotasPortugues.questao(14, q.id_local)} className="block">
          <QuestaoCard questao={q} />
        </Link>
      ))}

      {itens.length > visiveis.length && (
        <p className="text-center text-sm text-muted-foreground">
          {itens.length - visiveis.length} questões além das {MAX_EM_LISTA} exibidas —
          refina pela seção.
        </p>
      )}
    </div>
  );
}

function cnItem(ativo: boolean) {
  return [
    "rounded-full border px-3 py-1 text-xs transition-colors",
    ativo
      ? "border-orange-500 bg-orange-500 text-white"
      : "border-border text-muted-foreground hover:bg-muted",
  ].join(" ");
}
