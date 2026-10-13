import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { getQuestionWithOptions } from "@/lib/db/repositories/questoes";
import { CadernoMateria } from "@/components/questoes/caderno-materia";
import { DetalheQuestaoLote } from "@/components/questoes/detalhe-questao-lote";
import { DetalheQuestaoBanco } from "@/components/questoes/detalhe-questao-banco";
import { resolverRef } from "@/lib/questoes/cadernos";
import { estadoDoBanco, montarListagem } from "@/lib/questoes/listagem-caderno";
import { buscarQuestaoLocal } from "@/lib/questoes/dados-caderno";

/**
 * `/questoes/[ref]` — a única rota de questões do produto.
 *
 * `ref` é resolvido por forma (`resolverRef`): slug de matéria abre o caderno,
 * uuid abre a questão publicada, código de lote abre a questão ainda em arquivo.
 * Nada aqui sabe número de aula: "aula 14" é tag de procedência
 * (`/questoes/portugues?origem=aula-14`).
 *
 * As duas fontes convivem de propósito enquanto a homologação não termina: o
 * lote local é `em_revisao` e nunca foi escrito em banco, então a tela diz
 * separadamente o que é arquivo e o que é banco em vez de fingir um acervo só.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ref: string }>;
}): Promise<Metadata> {
  const { ref } = await params;
  const alvo = resolverRef(ref);
  if (alvo?.tipo === "caderno") {
    return {
      title: alvo.caderno.titulo,
      description: alvo.caderno.subtitulo,
    };
  }
  return { title: "Questão", description: "Questão de Língua Portuguesa para treino." };
}

export default async function QuestoesRefPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ref } = await params;
  const alvo = resolverRef(ref);
  if (!alvo) notFound();

  if (alvo.tipo === "questao-banco") {
    const [session, questao] = await Promise.all([
      auth(),
      getQuestionWithOptions(alvo.id).catch(() => null),
    ]);
    // Só questão pública e publicada tem detalhe em banco: item importado ainda
    // em revisão não se expõe por URL, e responder é fluxo do Caderno de Questões.
    if (!questao || !session?.user?.id) notFound();
    return <DetalheQuestaoBanco question={questao} userId={session.user.id} />;
  }

  if (alvo.tipo === "questao-lote") {
    const achado = buscarQuestaoLocal(alvo.codigo);
    if (!achado) notFound();
    return (
      <DetalheQuestaoLote
        caderno={achado.caderno}
        item={achado.item}
        vizinhos={achado.vizinhos}
      />
    );
  }

  const caderno = alvo.caderno;
  const listagem = montarListagem(caderno, await searchParams);

  return <CadernoMateria listagem={listagem} banco={await estadoDoBanco(caderno)} />;
}
