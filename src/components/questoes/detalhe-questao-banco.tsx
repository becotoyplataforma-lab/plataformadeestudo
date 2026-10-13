import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { QuestionCard } from "@/components/questoes/question-card";
import { rotasQuestoes } from "@/lib/questoes/rotas";
import type { Question } from "@/types";

/**
 * Detalhe de questão já publicada em banco (`/questoes/<uuid>`).
 *
 * É o plano pós-importação: a questão existe por identidade própria, e o único
 * contexto de navegação que ela tem é a matéria canônica (`subject.slug`), não o
 * material de origem. Banca, ano e origem continuam como metadado do card.
 */
export interface DetalheQuestaoBancoProps {
  question: Question;
  userId: string;
}

export function DetalheQuestaoBanco({ question, userId }: DetalheQuestaoBancoProps) {
  const slug = question.subject?.slug;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2 text-sm">
        <Link
          href={rotasQuestoes.raiz}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Caderno de Questões
        </Link>
        {slug && (
          <Link
            href={rotasQuestoes.caderno(slug)}
            className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
          >
            {question.subject?.name ?? slug}
          </Link>
        )}
      </div>

      <QuestionCard question={question} userId={userId} />
    </div>
  );
}
