"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, Check, Flag, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotaDoAluno } from "@/components/questoes/nota-do-aluno";
import { Sanfona } from "@/components/questoes/sanfona";
import { ModalSalvarCaderno } from "@/components/questoes/modal-salvar-caderno";
import {
  obterTentativa,
  questaoEstaEmQuaisCadernos,
  registrarTentativaLocal,
} from "@/lib/questoes/user-storage";
import { cn } from "@/lib/utils";
import { rotuloDaTag, type LoteProcedencia } from "@/lib/questoes/cadernos";
import {
  MOTIVO_PROCEDENCIA,
  SELO_PROCEDENCIA,
  alternativasOrdenadas,
  gabaritoConfiavel,
  rotuloGabarito,
  type QuestaoExtraida,
} from "@/lib/questoes/procedencia";
import { rotasQuestoes } from "@/lib/questoes/rotas";

/**
 * Card de questão do caderno — superfície da plataforma, não folha de prova.
 *
 * O card anterior fingia papel branco (`bg-white`, `text-slate-*`) dentro de um
 * app dark. Aqui ele volta a ser `bg-card` com tokens, com o que importa —
 * enunciado, alternativas, resposta — legível no tema do produto.
 *
 * O gabarito não aparece antes de responder. A linha `Gabarito: X` ao lado do
 * botão Responder transformava treino em leitura: a resposta estava na tela
 * antes de qualquer marcação. A letra correta agora mora na sanfona "Gabarito e
 * resolução", que o aluno abre quando quiser — e o smoke E2E tem caso que falha
 * se o spoiler voltar.
 *
 * Nada aqui imprime comentário de terceiro: `explicacao` é `null` por contrato
 * do extrator, e a UI diz isso em vez de preencher o vão com texto alheio.
 */

const LETRA_CIRCULO =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors";

/** Badge curto do cabeçalho: o que serve para decidir se vale a pena ler. */
function Selo({
  chave,
  variante = "neutro",
  children,
}: {
  chave: string;
  variante?: "materia" | "neutro";
  children: React.ReactNode;
}) {
  return (
    <span
      data-selo={chave}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variante === "materia"
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-muted/60 text-foreground"
      )}
    >
      {children}
    </span>
  );
}

export interface QuestaoCardProps {
  questao: QuestaoExtraida;
  /** Lote de procedência: alimenta a sanfona, nunca o nome da rota. */
  lote?: LoteProcedencia;
  /** Em lista o card é interativo, então o detalhe vira link próprio. */
  hrefDetalhe?: string;
  className?: string;
}

export function QuestaoCard({ questao, lote, hrefDetalhe, className }: QuestaoCardProps) {
  const [selecionada, setSelecionada] = React.useState<string | null>(null);
  const [respondida, setRespondida] = React.useState(false);
  const [modalCadernoAberto, setModalCadernoAberto] = React.useState(false);
  const [cadernosDestaQuestao, setCadernosDestaQuestao] = React.useState<string[]>([]);

  const confiavel = gabaritoConfiavel(questao);
  const acerto = respondida && confiavel ? selecionada === questao.gabarito : null;
  const alternativas = alternativasOrdenadas(questao);
  const ehCertoErrado = questao.tipo === "certo_errado";

  // Carrega tentativa prévia e cadernos personalizados ao montar no client
  React.useEffect(() => {
    const tentativa = obterTentativa(questao.id_local);
    if (tentativa) {
      setSelecionada(tentativa.letraSelecionada);
      setRespondida(true);
    }
    setCadernosDestaQuestao(questaoEstaEmQuaisCadernos(questao.id_local));

    const handleAtualizacao = () => {
      setCadernosDestaQuestao(questaoEstaEmQuaisCadernos(questao.id_local));
    };
    window.addEventListener("concursoai_cadernos_atualizado", handleAtualizacao);
    return () => {
      window.removeEventListener("concursoai_cadernos_atualizado", handleAtualizacao);
    };
  }, [questao.id_local]);

  function handleResponder() {
    if (!selecionada || !confiavel) return;
    setRespondida(true);
    const acertou = selecionada === questao.gabarito;
    registrarTentativaLocal(questao.id_local, selecionada, acertou);

    try {
      fetch(`/api/questoes/${questao.id_local}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedLetter: selecionada,
          isCorrect: acertou,
        }),
      }).catch(() => {
        // Modo offline / questão sintética
      });
    } catch {
      // Ignora erro de rede
    }
  }

  function handleRefazer() {
    setRespondida(false);
    setSelecionada(null);
  }

  return (
    <>
      <article
        data-questao={questao.id_local}
        className={cn(
          "overflow-hidden rounded-[var(--radius)] border border-border bg-card text-card-foreground shadow-md",
          className
        )}
      >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border px-5 py-3">
        <Selo chave="disciplina" variante="materia">
          {questao.disciplina || "Questão"}
        </Selo>
        {questao.banca && <Selo chave="banca">{questao.banca}</Selo>}
        {questao.assunto && <Selo chave="assunto">{questao.assunto}</Selo>}
        {questao.quarantined && (
          <Badge
            variant="outline"
            className="border-amber-500/50 bg-amber-500/10 text-amber-400"
            title={MOTIVO_PROCEDENCIA[questao.provenance_status]}
          >
            {SELO_PROCEDENCIA[questao.provenance_status]}
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-3">
          {questao.ano !== null && (
            <span data-selo="ano" className="text-xs tabular-nums text-muted-foreground">
              {questao.ano}
            </span>
          )}
          <code className="font-mono text-xs text-muted-foreground">{questao.codigo}</code>
        </span>
      </header>

      <div className="px-5 py-4">
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-card-foreground">
          {questao.enunciado}
        </p>

        <ul className="mt-4 space-y-2">
          {alternativas.map(({ letra, texto }) => {
            const marcada = selecionada === letra;
            const certa = acerto === true && marcada;
            const errada = acerto === false && marcada;
            return (
              <li key={letra}>
                <button
                  type="button"
                  onClick={() => !respondida && setSelecionada(letra)}
                  aria-pressed={marcada}
                  disabled={respondida}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    "border-border bg-muted/40 hover:bg-accent",
                    marcada && !respondida && "border-primary/60 bg-primary/10",
                    certa && "border-emerald-500/70 bg-emerald-500/10",
                    errada && "border-destructive/70 bg-destructive/10",
                    respondida && "cursor-default"
                  )}
                >
                  <span
                    className={cn(
                      LETRA_CIRCULO,
                      "border-primary/50 text-primary",
                      marcada && !respondida && "bg-primary/15",
                      certa && "border-emerald-500 bg-emerald-500 text-black",
                      errada && "border-destructive bg-destructive text-white"
                    )}
                    data-alternativa={letra}
                  >
                    {letra}
                  </span>
                  <span className="pt-1 text-card-foreground">
                    {/* Em certo/errado a letra sozinha não diz nada: "C — Certo". */}
                    {ehCertoErrado ? `${letra} — ${texto}` : texto}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            disabled={!selecionada || !confiavel || respondida}
            onClick={handleResponder}
          >
            Responder
          </Button>
          {acerto !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-sm font-semibold",
                acerto ? "text-emerald-400" : "text-destructive"
              )}
            >
              {acerto ? <Check className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
              {acerto ? "Você acertou" : "Você errou"}
            </span>
          )}
          {respondida && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefazer}
            >
              Refazer
            </Button>
          )}
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => setModalCadernoAberto(true)}
            className={cn(
              "border-white/10 hover:border-cyan-500/40 text-xs gap-1.5 transition-all",
              cadernosDestaQuestao.length > 0 && "border-cyan-500/50 bg-cyan-500/10 text-cyan-400 font-semibold"
            )}
            title="Salvar questão em listas e cadernos personalizados"
          >
            <Bookmark
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                cadernosDestaQuestao.length > 0 && "fill-cyan-400 text-cyan-400 scale-110"
              )}
            />
            {cadernosDestaQuestao.length > 0
              ? `Salva (${cadernosDestaQuestao.length})`
              : "Caderno"}
          </Button>
          {hrefDetalhe && (
            <Link
              href={hrefDetalhe}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Abrir questão
            </Link>
          )}
          {!confiavel && (
            <span className="text-xs text-muted-foreground">
              Sem resposta confiável: abra “Gabarito e resolução” para ver o motivo.
            </span>
          )}
        </div>
      </div>

      <footer>
        <Sanfona rotulo="Gabarito e resolução" id="gabarito">
          {confiavel ? (
            <p>
              Resposta:{" "}
              <strong className="font-mono text-card-foreground">{questao.gabarito}</strong>
              {ehCertoErrado && rotuloGabarito(questao) && (
                <span className="ml-1">({rotuloGabarito(questao)?.toLowerCase()})</span>
              )}
              {questao.origem_gabarito === "corpo_duplicado" && questao.doador_gabarito && (
                <span className="ml-2 text-xs">
                  recuperada da cópia{" "}
                  <Link
                    className="underline"
                    href={rotasQuestoes.questao(questao.doador_gabarito)}
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
              ? "Resolução comentada ainda não foi gerada para este item."
              : `Resolução: ${questao.resolucao_status}.`}
          </p>
        </Sanfona>

        <Sanfona rotulo="Comentários" id="comentarios">
          <NotaDoAluno idLocal={questao.id_local} />
        </Sanfona>

        <Sanfona rotulo="Procedência e estatísticas" id="procedencia">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Seção do material</dt>
            <dd className="text-card-foreground">{questao.secao_rotulo}</dd>
            <dt className="text-muted-foreground">Página no PDF</dt>
            <dd className="text-card-foreground tabular-nums">{questao.pagina_pdf}</dd>
            <dt className="text-muted-foreground">Lote</dt>
            <dd className="text-card-foreground">
              {lote ? rotuloDaTag("origem", lote.origem) : `Aula ${questao.aula}`}
              {lote?.alvo
                ? ` · alvo ${lote.alvo}`
                : questao.alvo_apostila
                  ? ` · alvo ${questao.alvo_apostila}`
                  : ""}
            </dd>
            <dt className="text-muted-foreground">Disciplina</dt>
            <dd className="text-card-foreground">{questao.disciplina || "não informada"}</dd>
            <dt className="text-muted-foreground">Assunto</dt>
            <dd className="text-card-foreground">{questao.assunto || "não informado"}</dd>
            <dt className="text-muted-foreground">Banca</dt>
            <dd className="text-card-foreground">{questao.banca ?? "não declarada"}</dd>
            <dt className="text-muted-foreground">Ano</dt>
            <dd className="text-card-foreground tabular-nums">
              {questao.ano ?? "não declarado"}
            </dd>
            <dt className="text-muted-foreground">Órgão</dt>
            <dd className="text-card-foreground">{questao.orgao ?? "não declarado"}</dd>
            <dt className="text-muted-foreground">Cargo</dt>
            <dd className="text-card-foreground">{questao.cargo ?? "não informado"}</dd>
            <dt className="text-muted-foreground">Dificuldade</dt>
            <dd className="text-card-foreground">
              {questao.nivel ?? "não declarada no material"}
            </dd>
            <dt className="text-muted-foreground">content_hash</dt>
            <dd className="font-mono text-card-foreground">
              {questao.content_hash.slice(0, 12)}…
            </dd>
            {questao.duplicata_de && (
              <>
                <dt className="text-muted-foreground">Cópia de</dt>
                <dd>
                  <Link
                    className="underline"
                    href={rotasQuestoes.questao(questao.duplicata_de)}
                  >
                    {questao.duplicata_de}
                  </Link>
                </dd>
              </>
            )}
          </dl>
          <p className="mt-3 text-xs">
            {questao.status === "em_revisao"
              ? "Item em revisão: ainda não publicado no banco. "
              : `Status ${questao.status}. `}
            Sem respostas registradas — taxa de acerto indisponível.
          </p>
        </Sanfona>
      </footer>
    </article>

    <ModalSalvarCaderno
      questaoId={questao.id_local}
      aberto={modalCadernoAberto}
      onOpenChange={setModalCadernoAberto}
      enunciadoResumido={questao.enunciado.slice(0, 140)}
    />
  </>
  );
}

export default QuestaoCard;
