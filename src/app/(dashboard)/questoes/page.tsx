import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CheckCircle, HelpCircle, Layers, Library, Sparkles } from "lucide-react";

import { CADERNOS, CADERNO_GERAL } from "@/lib/questoes/cadernos";
import { estadoDoBanco, montarListagem } from "@/lib/questoes/listagem-caderno";
import { rotasQuestoes } from "@/lib/questoes/rotas";
import { HeaderQuestoes } from "@/components/questoes/header-questoes";
import { BarraFiltros } from "@/components/questoes/barra-filtros";
import { QuestaoCard } from "@/components/questoes/questao-card";
import { Paginacao } from "@/components/questoes/paginacao";

export const metadata: Metadata = {
  title: "Filtro de Questões · Playground",
  description: "Filtro e banco completo de questões para concursos públicos com gabarito oficial.",
};

export default async function QuestoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const busca = await searchParams;
  const abaAtiva = busca.aba === "cadernos" ? "cadernos" : busca.aba === "salvos" ? "salvos" : "filtro";

  // Se a aba selecionada for "Cadernos", renderiza o catálogo de cadernos por matéria
  if (abaAtiva === "cadernos") {
    return (
      <div className="min-h-screen bg-slate-950 text-white pb-16">
        <HeaderQuestoes abaAtiva="cadernos" />

        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400">
                Catálogo por Disciplina
              </p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight text-white">
                Cadernos de Questões por Matéria
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-400">
                Acesse diretamente o caderno temático de cada disciplina com todas as questões organizadas.
              </p>
            </div>
            <Link
              href="/questoes"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
            >
              Voltar ao filtro geral &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CADERNOS.map((caderno) => {
              const listagem = montarListagem(caderno, {});
              return (
                <Link
                  key={caderno.slug}
                  href={rotasQuestoes.caderno(caderno.slug)}
                  className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-sm hover:border-cyan-500/60 hover:shadow-lg hover:shadow-cyan-950/20 transition-all"
                >
                  <div className="space-y-2.5">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 px-3 py-1 text-xs font-bold text-cyan-300">
                      <BookOpen className="h-3.5 w-3.5" />
                      {caderno.materia}
                    </div>
                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {caderno.titulo}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {caderno.subtitulo}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
                    <span className="font-semibold text-slate-300">
                      {listagem.acervo.itens.length} questões disponíveis
                    </span>
                    <span className="text-cyan-400 font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                      Abrir caderno &rarr;
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // Aba padrão: Filtro clássico estilo QConcursos com cores integradas do app (/apostilas)
  const listagem = montarListagem(CADERNO_GERAL, busca);
  const { filtros, pagina, acervo, visiveis } = listagem;

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      <HeaderQuestoes abaAtiva="filtro" totalDisponivel={acervo.itens.length} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* BARRA DE FILTROS ESTILO QCONCURSOS EM TEMA CYBER/DARK APOSTILAS */}
        <BarraFiltros
          acao="/questoes"
          filtros={filtros}
          opcoes={listagem.opcoes}
          abas={listagem.abas}
          refinamentos={listagem.refinamentos}
          porPagina={pagina.porPagina}
        />

        {/* STATUS DO RESULTADO */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/10 pb-3 pt-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">
              Questões encontradas
            </h2>
            <span className="rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-0.5 text-xs font-bold tabular-nums">
              {pagina.totalItens}
            </span>
          </div>

          <span className="text-xs text-slate-400 font-medium">
            {pagina.totalItens === 0
              ? "Nenhuma questão encontrada com os filtros selecionados"
              : `Exibindo ${pagina.inicio} a ${pagina.fim} de ${pagina.totalItens} questões`}
          </span>
        </div>

        {/* LISTAGEM DE QUESTÕES */}
        <section className="space-y-6" aria-label="Questões encontradas">
          {visiveis.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/50 p-12 text-center shadow-xs">
              <HelpCircle className="mx-auto h-12 w-12 text-slate-500" />
              <h3 className="mt-3 text-base font-bold text-white">
                Nenhuma questão encontrada com esses filtros
              </h3>
              <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                Tente selecionar menos filtros ou clique em "Limpar" para voltar a ver todas as questões do acervo.
              </p>
              <div className="mt-4">
                <Link
                  href="/questoes"
                  className="inline-flex items-center rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-cyan-500 transition-all"
                >
                  Limpar todos os filtros
                </Link>
              </div>
            </div>
          ) : (
            visiveis.map(({ questao, lote }) => (
              <QuestaoCard
                key={questao.id_local}
                questao={questao}
                lote={lote}
                hrefDetalhe={rotasQuestoes.questao(questao.id_local)}
              />
            ))
          )}

          <Paginacao slug="geral" filtros={filtros} pagina={pagina} caminhoBase="/questoes" />
        </section>
      </main>
    </div>
  );
}
