import Link from "next/link";
import { BookOpen, CheckCircle, Database, HelpCircle, Layers, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { HeaderQuestoes } from "@/components/questoes/header-questoes";
import { BarraFiltros } from "@/components/questoes/barra-filtros";
import { Paginacao } from "@/components/questoes/paginacao";
import { QuestaoCard } from "@/components/questoes/questao-card";
import { Sanfona } from "@/components/questoes/sanfona";
import type { EstadoBanco, ListagemCaderno } from "@/lib/questoes/listagem-caderno";
import { rotasQuestoes } from "@/lib/questoes/rotas";

export interface CadernoMateriaProps {
  listagem: ListagemCaderno;
  banco: EstadoBanco;
}

export function CadernoMateria({ listagem, banco }: CadernoMateriaProps) {
  const { caderno, filtros, pagina, acervo, filtrados, visiveis, carga, assuntos, semBanca } =
    listagem;
  const ausentes = carga ? carga.ausentes : caderno.lotes.map((l) => l.origem);

  const alvoDeclarado = caderno.lotes
    .map((l) => (l.alvo ? `${l.descricao} — alvo ${l.alvo}` : l.descricao))
    .join(" · ");

  const confiaveis = acervo.itens.length - acervo.semGabaritoConfiavel;
  const quarentena = acervo.itens.filter(({ questao }) => questao.quarantined).length;

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950/60 pb-16">
      <HeaderQuestoes abaAtiva="cadernos" totalDisponivel={confiaveis} />

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* CABEÇALHO DA MATÉRIA */}
        <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#004742] via-[#005953] to-[#007068] p-6 text-white shadow-md sm:p-8">
          <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-teal-300/10 blur-2xl" />
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
                  <Layers className="h-3.5 w-3.5 text-teal-200" />
                  Caderno de Questões
                </span>
                <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-none font-bold">
                  {confiaveis} questões disponíveis
                </Badge>
                {acervo.semGabaritoConfiavel > 0 && (
                  <span className="text-xs text-teal-100/80" data-pendencia>
                    ({acervo.semGabaritoConfiavel} em revisão)
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
                {caderno.titulo}
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-teal-100/90 leading-relaxed">
                {caderno.subtitulo}
              </p>
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl bg-white/10 p-4 backdrop-blur-xs sm:text-right border border-white/10">
              <span className="text-xs uppercase tracking-wider text-teal-200 font-bold">Status do Acervo</span>
              <span className="text-lg font-black text-white">{pagina.totalItens} Filtradas</span>
              <span data-contagem className="text-xs text-teal-100 font-medium">
                {pagina.totalItens === 0
                  ? "Nenhuma questão encontrada"
                  : `Exibindo ${pagina.inicio} a ${pagina.fim} de ${pagina.totalItens}`}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/10 pt-3 text-xs text-teal-100/80">
            <span>Origem: {alvoDeclarado || "Lote Oficial"}</span>
            <span>·</span>
            <span>Gabarito Oficial e Comentários Integrados</span>
          </div>
        </header>

        {/* BARRA DE FILTROS ESTILO QCONCURSOS */}
        <BarraFiltros
          acao={rotasQuestoes.caderno(caderno.slug)}
          filtros={filtros}
          opcoes={listagem.opcoes}
          abas={listagem.abas}
          refinamentos={listagem.refinamentos}
          porPagina={pagina.porPagina}
        />

        {/* SANFONA INFORMATIVA SOBRE O LOTE */}
      <Sanfona rotulo="Detalhes técnicos deste acervo de questões" id="lote">
        <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
          <li>
            Total de linhas no acervo: <strong className="text-slate-900 dark:text-slate-200">{acervo.linhas}</strong>. Cópia idêntica desconsiderada:{" "}
            <strong className="text-slate-900 dark:text-slate-200">{acervo.duplicatas}</strong>.
          </li>
          <li>
            Classificação por assuntos: <strong className="text-slate-900 dark:text-slate-200">{assuntos.length}</strong> temas catalogados.
          </li>
          {semBanca > 0 && (
            <li>
              Questões sem banca explícita no enunciado: <strong className="text-slate-900 dark:text-slate-200">{semBanca}</strong>.
            </li>
          )}
        </ul>
      </Sanfona>

      {/* LISTA DE QUESTÕES */}
      <main className="space-y-6" aria-label="Questões do caderno">
        {visiveis.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
            <HelpCircle className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-3 text-base font-bold text-slate-800 dark:text-slate-200">
              Nenhuma questão encontrada com esses filtros
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Tente selecionar menos filtros ou clique em "Limpar filtros" para ver todas as questões.
            </p>
            <div className="mt-4">
              <Link
                href={rotasQuestoes.caderno(caderno.slug)}
                className="inline-flex items-center rounded-lg bg-[#005953] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#004742]"
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

        <Paginacao slug={caderno.slug} filtros={filtros} pagina={pagina} />
      </main>
    </div>
  </div>
  );
}

export default CadernoMateria;
