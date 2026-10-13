import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { listBancas, listQuestions, listSubjects } from "@/lib/db/repositories/questoes";
import { QuestionBrowser } from "@/components/questoes/question-browser";
import { montarListagem } from "@/lib/questoes/listagem-caderno";
import { rotasQuestoes } from "@/lib/questoes/rotas";
import { CADERNOS } from "@/lib/questoes/cadernos";

export const metadata: Metadata = {
  title: "Questões do banco",
  description: "Questões publicadas no banco, já importadas e moderadas.",
};

/**
 * `/questoes/banco` — o acervo publicado em `questions`, com paginação própria.
 *
 * Existia antes como `/questoes`, e foi aí que o problema apareceu: os testes
 * de integração inserem questões `publicada`/`isPublic` sem `user_id`, e
 * `deleteTestUser()` não alcança essas linhas. O aluno abria `/questoes` e via
 * "E2E 58f07a7b". A leitura agora exclui fixtura
 * (`src/lib/db/fixturas-de-teste.ts`), e a rota própria deixa de competir com o
 * caderno — que é o que o aluno estuda hoje.
 */
export default async function QuestoesBancoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [inicial, bancas, subjects] = await Promise.all([
    listQuestions({ page: 1, pageSize: 15 }),
    listBancas(),
    listSubjects(),
  ]);

  // Nada publicado é o estado de hoje: o lote ainda não passou por importação.
  // A tela diz isso e aponta o caderno em vez de fingir um acervo vazio — e em
  // vez de renderizar o caderno aqui, para `/questoes/banco` não virar segunda
  // URL canônica do mesmo conteúdo.
  if (inicial.total === 0) {
    const primeiro = CADERNOS[0];
    const totalLocal = primeiro ? montarListagem(primeiro, {}).acervo.itens.length : 0;
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Questões do banco</h1>
        <p className="text-sm text-muted-foreground">
          Nenhuma questão publicada no banco ainda. Os metadados de leitura
          continuam disponíveis: {bancas.length} banca(s) e {subjects.length} matéria(s)
          catalogada(s).
        </p>
        {primeiro && (
          <p className="text-sm">
            O acervo que o aluno estuda hoje está no caderno:{" "}
            <a href={rotasQuestoes.caderno(primeiro.slug)} className="underline">
              {primeiro.titulo}
            </a>{" "}
            ({totalLocal} questões em revisão).
          </p>
        )}
      </div>
    );
  }

  return (
    <QuestionBrowser
      initialQuestions={inicial.data}
      initialTotal={inicial.total}
      bancas={bancas}
      subjects={subjects}
      userId={session.user.id}
    />
  );
}

