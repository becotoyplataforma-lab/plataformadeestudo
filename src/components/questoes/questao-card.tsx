"use client";

import * as React from "react";
import Link from "next/link";
import { Check, EyeOff, Flag, MessageSquareOff, Sparkles } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MOTIVO_PROCEDENCIA,
  SELO_PROCEDENCIA,
  alternativasOrdenadas,
  gabaritoConfiavel,
  rotuloGabarito,
  selosMetadados,
  trilhaMetadados,
  type QuestaoExtraida,
} from "@/lib/questoes/procedencia";
import { rotasPortugues } from "@/lib/questoes/rotas";

/**
 * Card de questão no padrão de leitura do QConcursos: cabeçalho com código
 * monoespaçado, trilha de metadados, alternativas circulares, botão Responder
 * e rodapé expansível.
 *
 * A superfície é branca de propósito, com cores explícitas em vez de tokens
 * (`bg-white`, `text-slate-*`): o resto do app é dark theme, e um card que
 * herda `--background` aqui ficaria ilegível ou levaria o tema escuro para
 * dentro de uma superfície que quer parecer material de prova.
 *
 * Nada aqui exibe comentário de terceiro: o JSON público não tem `explicacao`
 * (é `null` por contrato do extrator), e a UI diz isso em vez de preencher o
 * espaço com texto copiado do material.
 */

const LETRA_CIRCULO =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold";

export interface QuestaoCardProps {
  questao: QuestaoExtraida;
  /** Detalhe com rodapé expansível. Em lista, passa false. */
  expandida?: boolean;
  className?: string;
}

export function QuestaoCard({ questao, expandida = false, className }: QuestaoCardProps) {
  const [selecionada, setSelecionada] = React.useState<string | null>(null);
  const [revelada, setRevelada] = React.useState(false);

  const confiavel = gabaritoConfiavel(questao);
  const acerto = revelada && questao.gabarito ? selecionada === questao.gabarito : null;
  const trilha = trilhaMetadados(questao);
  const selos = selosMetadados(questao);
  const alternativas = alternativasOrdenadas(questao);

  return (
    <article
      className={cn("rounded-2xl bg-white text-slate-900 shadow-sm ring-1 ring-slate-200", className)}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 px-5 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
          {questao.numero_original}
        </span>
        <code className="font-mono text-xs tracking-tight text-slate-500">{questao.codigo}</code>
        {selos.length > 0 && (
          <span
            className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1"
            title={trilha.join(" ▸ ")}
            aria-label="Metadados da questão"
          >
            {selos.map((selo, i) => (
              <React.Fragment key={selo.chave}>
                {i > 0 && (
                  <span aria-hidden="true" className="text-slate-300">
                    ▸
                  </span>
                )}
                <span
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                  data-selo={selo.chave}
                >
                  {selo.texto}
                </span>
              </React.Fragment>
            ))}
          </span>
        )}
        {questao.quarantined && (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-amber-800"
            title={MOTIVO_PROCEDENCIA[questao.provenance_status]}
          >
            {SELO_PROCEDENCIA[questao.provenance_status]}
          </Badge>
        )}
      </header>

      <div className="px-5 py-4">
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-800">
          {questao.enunciado}
        </p>

        <ul className="mt-4 space-y-2">
          {alternativas.map(({ letra, texto }) => {
            const marcada = selecionada === letra;
            const correta = revelada && questao.gabarito === letra;
            return (
              <li key={letra}>
                <button
                  type="button"
                  onClick={() => setSelecionada(letra)}
                  aria-pressed={marcada}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors",
                    "border-slate-100 hover:border-orange-200 hover:bg-orange-50/40",
                    marcada && "border-orange-400 bg-orange-50",
                    correta && "border-emerald-500 bg-emerald-50"
                  )}
                >
                  <span
                    className={cn(
                      LETRA_CIRCULO,
                      "border-orange-400 text-orange-600",
                      marcada && "border-orange-500 bg-orange-500 text-white",
                      correta && "border-emerald-500 bg-emerald-500 text-white"
                    )}
                    data-alternativa={letra}
                  >
                    {letra}
                  </span>
                  <span className="pt-1 text-slate-800">{texto}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="bg-orange-500 text-white hover:bg-orange-600"
            disabled={!selecionada}
            onClick={() => setRevelada(true)}
          >
            Responder
          </Button>
          {acerto !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-sm font-semibold",
                acerto ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {acerto ? <Check className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
              {acerto ? "Você acertou" : "Você errou"}
            </span>
          )}
          {confiavel && (
            <span className="text-xs text-slate-500">
              Gabarito: <strong className="font-mono">{rotuloGabarito(questao)}</strong>
            </span>
          )}
        </div>
      </div>

      {expandida && (
        <footer className="border-t border-slate-100 px-5 py-2">
          <Accordion type="single" collapsible>
            <AccordionItem value="gabarito">
              <AccordionTrigger className="text-slate-700">Gabarito e resolução</AccordionTrigger>
              <AccordionContent className="text-slate-600">
                {confiavel ? (
                  <p>
                    Resposta: <strong className="font-mono">{questao.gabarito}</strong>
                    {questao.tipo === "certo_errado" && ` (${rotuloGabarito(questao)?.toLowerCase()})`}
                    {questao.origem_gabarito === "corpo_duplicado" && questao.doador_gabarito && (
                      <span className="ml-2 text-xs">
                        recuperada da cópia{" "}
                        <Link
                          className="underline"
                          href={rotasPortugues.questao(questao.aula, questao.doador_gabarito)}
                        >
                          {questao.doador_gabarito}
                        </Link>
                      </span>
                    )}
                  </p>
                ) : (
                  <p>{MOTIVO_PROCEDENCIA[questao.provenance_status]}</p>
                )}
                <p className="mt-2 flex items-center gap-2 text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  {questao.resolucao_status === "pendente_geracao"
                    ? "Resolução por IA ainda não foi gerada para este item."
                    : questao.resolucao_status}
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="comentarios">
              <AccordionTrigger className="text-slate-700">Comentários</AccordionTrigger>
              <AccordionContent className="text-slate-600">
                <p className="flex items-start gap-2">
                  <MessageSquareOff className="mt-0.5 h-4 w-4 shrink-0" />
                  Comentário de terceiro não é publicado. Ele existe apenas no arquivo local
                  de revisão (<code className="font-mono text-xs">comentarios_aula_14_LOCAL.json</code>),
                  que não entra no banco nem em artefato público.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="procedencia">
              <AccordionTrigger className="text-slate-700">Procedência e estatísticas</AccordionTrigger>
              <AccordionContent className="text-slate-600">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                  <dt className="text-slate-400">Seção</dt>
                  <dd>{questao.secao_rotulo}</dd>
                  <dt className="text-slate-400">Página no PDF</dt>
                  <dd>{questao.pagina_pdf}</dd>
                  <dt className="text-slate-400">Alvo do material</dt>
                  <dd>{questao.alvo_apostila}</dd>
                  <dt className="text-slate-400">Banca declarada</dt>
                  <dd>{questao.banca ?? "não informada"}</dd>
                  <dt className="text-slate-400">Ano declarado</dt>
                  <dd>{questao.ano ?? "não informado"}</dd>
                  <dt className="text-slate-400">Órgão declarado</dt>
                  <dd>{questao.orgao ?? "não informado"}</dd>
                  <dt className="text-slate-400">Cargo declarado</dt>
                  <dd>{questao.cargo ?? "não informado"}</dd>
                  <dt className="text-slate-400">Assunto</dt>
                  <dd>{questao.assunto || "não informado"}</dd>
                  <dt className="text-slate-400">Origem do gabarito</dt>
                  <dd>{questao.origem_gabarito}</dd>
                  <dt className="text-slate-400">contentHash</dt>
                  <dd className="font-mono">{questao.content_hash.slice(0, 12)}…</dd>
                </dl>
                <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <EyeOff className="h-3.5 w-3.5" />
                  Status {questao.status} · não publicada · estatísticas de acerto só
                  existem depois que o item entra no banco e recebe respostas.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </footer>
      )}
    </article>
  );
}

export default QuestaoCard;
