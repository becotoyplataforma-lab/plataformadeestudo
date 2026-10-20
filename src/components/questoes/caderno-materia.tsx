import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { BarraFiltros } from "@/components/questoes/barra-filtros";
import { Paginacao } from "@/components/questoes/paginacao";
import { QuestaoCard } from "@/components/questoes/questao-card";
import { Sanfona } from "@/components/questoes/sanfona";
import type { EstadoBanco, ListagemCaderno } from "@/lib/questoes/listagem-caderno";
import { rotasQuestoes } from "@/lib/questoes/rotas";

/**
 * Caderno de uma matéria: o acervo local em revisão, filtrável e paginado.
 *
 * O cabeçalho é domínio ("Português · Banco de Questões"); banca, ano, assunto e
 * lote são colunas de filtro. É assim que a segunda apostila entra sem mudar
 * uma linha de componente: quem muda é o catálogo.
 *
 * O filtro vive na URL, não em estado de cliente: `<form method="get">` com
 * selects nativos. A tela continua renderizada em servidor, o link continua
 * compartilhável e a página 2 de um assunto continua sendo um link.
<<<<<<< HEAD
=======
 *
 * O card deixou de ser envolvido por `<Link>`: dentro de um link, marcar
 * alternativa e abrir sanfona virava navegação. O card é interativo e o detalhe
 * tem link próprio.
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
 */

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
<<<<<<< HEAD
    <div className="w-full">
      {/* Top Teal Header Banner with "Questões" title and navigation sub-tabs */}
      <div className="-mx-4 -mt-6 md:-mx-8 md:-mt-6 bg-[#006472] pt-8 pb-3 px-4 sm:px-6 lg:px-8 text-white shadow-xs">
        <div className="max-w-6xl mx-auto space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-white">Questões</h1>

          {/* Subnavigation Tabs */}
          <nav className="flex items-center gap-1.5 pt-2">
            <div className="px-5 py-2.5 rounded-t-xl bg-[#00525d] text-white font-medium text-sm flex items-center gap-2 border-t border-x border-[#004751] shadow-2xs">
              Filtro de questões
            </div>
            <Link
              href="/cadernos"
              className="px-5 py-2.5 text-white/80 hover:text-white font-medium text-sm transition-colors rounded-t-xl hover:bg-white/10"
            >
              Cadernos
            </Link>
            <Link
              href="#filtros-salvos"
              className="px-5 py-2.5 text-white/80 hover:text-white font-medium text-sm transition-colors rounded-t-xl hover:bg-white/10"
            >
              Filtros salvos
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Container below banner */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <BarraFiltros
          acao={rotasQuestoes.caderno(caderno.slug)}
          filtros={filtros}
          opcoes={listagem.opcoes}
          abas={listagem.abas}
          refinamentos={listagem.refinamentos}
          porPagina={pagina.porPagina}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{caderno.titulo}</h2>
            <Badge variant="secondary">{confiaveis} questões</Badge>
            {acervo.semGabaritoConfiavel > 0 && (
              <span className="text-xs text-muted-foreground" data-pendencia>
                {acervo.itens.length} no acervo total: {acervo.semGabaritoConfiavel} em revisão
              </span>
            )}
          </div>
          <p data-contagem className="text-sm font-medium text-foreground">
            {pagina.totalItens === 0
              ? "Nenhuma questão com esses filtros"
              : `Exibindo ${pagina.inicio} a ${pagina.fim} de ${pagina.totalItens} questões`}
          </p>
        </div>

        <Sanfona rotulo="Sobre este acervo" id="lote">
          <ul className="space-y-1 text-xs">
            <li>
              Linhas no lote: {acervo.linhas}. Cópia idêntica desconsiderada:{" "}
              {acervo.duplicatas} — o PDF publica a mesma questão na seção comentada e
              na lista de gabaritos, e somar as duas seria inflar o acervo.
            </li>
            <li>
              Gabarito que o material sustenta: {confiaveis}. Sem resposta confiável:{" "}
              {acervo.semGabaritoConfiavel} (em quarentena: {quarentena}).
            </li>
            <li>
              Assuntos: {assuntos.length}. Sem banca declarada: {semBanca} de{" "}
              {acervo.itens.length}.
            </li>
            <li>
              O que já foi importado e publicado fica no navegador do banco:{" "}
              <Link href={rotasQuestoes.banco()} className="underline">
                /questoes/banco
              </Link>
              .
            </li>
            {carga && carga.descartadas.length > 0 && (
              <li>
                {carga.descartadas.length} linha(s) descartada(s) por violação de forma
                ({carga.descartadas
                  .slice(0, 5)
                  .map((d) => `${d.id}: ${d.motivo}`)
                  .join("; ")}
                {carga.descartadas.length > 5 ? "; …" : ""}) — nada é ignorado em silêncio.
              </li>
            )}
            {!carga && (
              <li>
                Nenhum lote local lido: o diretório do dataset não está configurado
                (`MATERIAIS_DATASET_DIR`) ou os arquivos do caderno não existem nele.
              </li>
            )}
          </ul>
        </Sanfona>

        {ausentes.length > 0 && (
          <p className="text-xs text-amber-400">
            Lote(s) declarado(s) no catálogo sem arquivo no diretório: {ausentes.join(", ")}.
          </p>
        )}

        {filtrados.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center bg-card">
            <p className="text-sm font-medium">Nenhuma questão com esses filtros</p>
            <p className="mt-1 text-sm text-muted-foreground">
              O filtro é a URL: limpe a barra acima para voltar ao acervo inteiro.
            </p>
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
      </div>
=======
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{caderno.titulo}</h1>
          <Badge variant="secondary">{confiaveis} questões</Badge>
          {acervo.semGabaritoConfiavel > 0 && (
            <span className="text-xs text-muted-foreground" data-pendencia>
              {acervo.itens.length} no acervo inteiro: {acervo.semGabaritoConfiavel} estão em
              revisão sem gabarito confirmado, e só entram com o filtro ligado.
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{caderno.subtitulo}</p>
        <p data-contagem className="text-sm font-medium text-foreground">
          {pagina.totalItens === 0
            ? "Nenhuma questão com esses filtros"
            : `Exibindo ${pagina.inicio} a ${pagina.fim} de ${pagina.totalItens} questões`}
        </p>
        <p className="text-xs text-muted-foreground">
          Procedência do acervo local: {alvoDeclarado || "não declarada"}. É metadado do
          material, não concurso — o caderno é o mesmo para qualquer edital.
        </p>
        {banco.erro ? (
          <p className="text-xs text-amber-400">
            Banco indisponível nesta leitura ({banco.erro}); a contagem publicada fica
            oculta em vez de aparecer como zero.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {banco.subjectId
              ? `Publicadas no banco para ${caderno.materia}: ${banco.publicas ?? 0}. `
              : `A matéria canônica "${caderno.materia}" ainda não está no catálogo do banco. `}
            Tudo abaixo está em <code className="font-mono">em_revisao</code> e não
            publicado: o gabarito vem do próprio material, e o que ele não diz fica
            marcado como pendência.
          </p>
        )}
      </header>

      <BarraFiltros
        acao={rotasQuestoes.caderno(caderno.slug)}
        filtros={filtros}
        opcoes={listagem.opcoes}
        abas={listagem.abas}
        refinamentos={listagem.refinamentos}
        porPagina={pagina.porPagina}
      />

      <Sanfona rotulo="Sobre este acervo" id="lote">
        <ul className="space-y-1 text-xs">
          <li>
            Linhas no lote: {acervo.linhas}. Cópia idêntica desconsiderada:{" "}
            {acervo.duplicatas} — o PDF publica a mesma questão na seção comentada e
            na lista de gabaritos, e somar as duas seria inflar o acervo.
          </li>
          <li>
            Gabarito que o material sustenta: {confiaveis}. Sem resposta confiável:{" "}
            {acervo.semGabaritoConfiavel} (em quarentena: {quarentena}).
          </li>
          <li>
            Assuntos: {assuntos.length}. Sem banca declarada: {semBanca} de{" "}
            {acervo.itens.length}.
          </li>
          <li>
            O que já foi importado e publicado fica no navegador do banco:{" "}
            <Link href={rotasQuestoes.banco()} className="underline">
              /questoes/banco
            </Link>
            .
          </li>
          {carga && carga.descartadas.length > 0 && (
            <li>
              {carga.descartadas.length} linha(s) descartada(s) por violação de forma
              ({carga.descartadas
                .slice(0, 5)
                .map((d) => `${d.id}: ${d.motivo}`)
                .join("; ")}
              {carga.descartadas.length > 5 ? "; …" : ""}) — nada é ignorado em silêncio.
            </li>
          )}
          {!carga && (
            <li>
              Nenhum lote local lido: o diretório do dataset não está configurado
              (`MATERIAIS_DATASET_DIR`) ou os arquivos do caderno não existem nele.
            </li>
          )}
        </ul>
      </Sanfona>

      {ausentes.length > 0 && (
        <p className="text-xs text-amber-400">
          Lote(s) declarado(s) no catálogo sem arquivo no diretório: {ausentes.join(", ")}.
        </p>
      )}

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">Nenhuma questão com esses filtros</p>
          <p className="mt-1 text-sm text-muted-foreground">
            O filtro é a URL: limpe a barra acima para voltar ao acervo inteiro.
          </p>
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
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
    </div>
  );
}

export default CadernoMateria;
