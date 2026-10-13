import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { QuestaoCard } from "@/components/questoes/questao-card";
import type { Caderno, ItemCaderno } from "@/lib/questoes/cadernos";
import { rotasQuestoes } from "@/lib/questoes/rotas";

/**
 * Detalhe de uma questão que ainda vive só no lote extraído (arquivo), antes de
 * qualquer importação.
 *
 * O contexto de navegação é a matéria: o link de volta diz
 * "Português · Banco de Questões" e leva ao caderno. O código do lote
 * (`A14-S01-001`) aparece como identificador monoespaçado — é chave, não nome —
 * e a procedência completa (seção, página do PDF, banca, alvo) está dentro da
 * sanfona do card.
 */
export interface DetalheQuestaoLoteProps {
  caderno: Caderno;
  item: ItemCaderno;
  /** Itens da mesma seção, sem quarentena: sustentam anterior/próxima. */
  vizinhos: ItemCaderno[];
}

export function DetalheQuestaoLote({ caderno, item, vizinhos }: DetalheQuestaoLoteProps) {
  const questao = item.questao;
  const idx = vizinhos.findIndex((v) => v.questao.id_local === questao.id_local);
  const anterior = idx > 0 ? vizinhos[idx - 1] : null;
  const proxima = idx >= 0 && idx < vizinhos.length - 1 ? vizinhos[idx + 1] : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-3 text-sm">
        <Link
          href={rotasQuestoes.caderno(caderno.slug)}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {caderno.titulo}
        </Link>
        <span className="font-mono text-xs text-muted-foreground">{questao.codigo}</span>
      </div>

      <QuestaoCard questao={questao} lote={item.lote} />

      <div className="flex items-center justify-between gap-2 pt-2">
        {anterior ? (
          <Link
            href={rotasQuestoes.questao(anterior.questao.id_local)}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            ← {anterior.questao.codigo}
          </Link>
        ) : (
          <span />
        )}
        {proxima && (
          <Link
            href={rotasQuestoes.questao(proxima.questao.id_local)}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            {proxima.questao.codigo} →
          </Link>
        )}
      </div>
    </div>
  );
}
