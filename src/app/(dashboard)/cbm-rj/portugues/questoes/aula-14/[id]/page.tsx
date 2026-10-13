import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { QuestaoCard } from "@/components/questoes/questao-card";
import { buscarAula14, carregarAula14 } from "@/lib/questoes/dados-aula-14";
import { ehIdLocalValido, rotasPortugues } from "@/lib/questoes/rotas";

/** Detalhe de uma questão extraída, com rodapé expansível. */

export default async function QuestaoAula14Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehIdLocalValido(id)) notFound();

  const questao = buscarAula14(id);
  if (!questao) notFound();

  const carga = carregarAula14();
  const irma = carga?.questoes.filter((q) => q.secao === questao.secao && !q.quarantined) ?? [];
  const idx = irma.findIndex((q) => q.id_local === questao.id_local);
  const anterior = idx > 0 ? irma[idx - 1] : null;
  const proxima = idx >= 0 && idx < irma.length - 1 ? irma[idx + 1] : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between text-sm">
        <Link
          href={rotasPortugues.questoes(questao.aula)}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Aula {questao.aula}
        </Link>
        <span className="font-mono text-xs text-muted-foreground">{questao.codigo}</span>
      </div>

      <QuestaoCard questao={questao} expandida />

      <div className="flex items-center justify-between gap-2 pt-2">
        {anterior ? (
          <Link
            href={rotasPortugues.questao(questao.aula, anterior.id_local)}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            ← {anterior.codigo}
          </Link>
        ) : (
          <span />
        )}
        {proxima && (
          <Link
            href={rotasPortugues.questao(questao.aula, proxima.id_local)}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            {proxima.codigo} →
          </Link>
        )}
      </div>
    </div>
  );
}
