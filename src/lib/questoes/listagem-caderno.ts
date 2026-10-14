import "server-only";

import { KnowledgeSubjectRepository } from "@/lib/knowledge/repositories/subject.repository";
import { countPublicasDaMateria } from "@/lib/db/repositories/questoes";
import {
  aplicarFiltros,
  calcularPagina,
  contagemPorAssunto,
  facetas,
  fatiarPagina,
  lerFiltros,
  opcoesDoContexto,
  refinamentosDoContexto,
  removerCopiasIdenticas,
  semFaceta,
  totaisDasAbas,
  type AbaComTotal,
  type AcervoDistinto,
  type Caderno,
  type ChaveDeContagem,
  type Facetas,
  type FiltrosCaderno,
  type ItemCaderno,
  type OpcaoFaceta,
  type Pagina,
  type RefinamentosCaderno,
} from "./cadernos";
import { carregarCaderno, type CargaCaderno } from "./dados-caderno";

/**
 * Seleção do caderno: o caminho inteiro entre o lote em arquivo e a página.
 *
 * Vive fora das rotas porque `/questoes` e `/questoes/portugues` são a mesma
 * tela: se a regra de deduplicação ou de página mora em um dos dois, eles
 * divergem e a contagem exibida deixa de ser a verdade do acervo.
 *
 * A ordem importa:
 *  1. lê-se o lote (validação de forma já feita pelo carregador);
 *  2. colapsam-se as cópias idênticas por `content_hash` — sem isso a tela
 *     afirmaria 1.736 questões quando o material tem 920 distintas;
 *  3. aplicam-se os filtros da URL sobre o acervo distinto — e o padrão de
 *     qualidade (só gabarito que o material sustenta) já está dentro desses
 *     filtros, por isso a tela abre em 886 e não em 918 (docs/31 §7.6);
 *  4. corta-se a página pedida, com o `page` amarrado ao total real;
 *  5. contam-se abas, facetas e refinamentos sobre o mesmo acervo, cada um no
 *     contexto em que o clique do aluno vai cair.
 */

/** Uma linha de select por faceta contável, com o total medido no contexto. */
export type OpcoesDeFiltro = Record<ChaveDeContagem, OpcaoFaceta[]>;

export interface ListagemCaderno {
  caderno: Caderno;
  carga: CargaCaderno | null;
  filtros: FiltrosCaderno;
  pagina: Pagina;
  /** Acervo distinto do lote inteiro, antes dos filtros. */
  acervo: AcervoDistinto;
  /** Itens distintos que passaram nos filtros. */
  filtrados: ItemCaderno[];
  /** Só o recorte da página corrente: é o que vira card. */
  visiveis: ItemCaderno[];
  opcoes: OpcoesDeFiltro;
  /** As duas abas do topo, com o total que cada clique devolve. */
  abas: AbaComTotal[];
  /** Quantos itens cada caixa de refinamento movimenta no contexto vigente. */
  refinamentos: RefinamentosCaderno;
  facetas: Facetas;
  assuntos: { assunto: string; total: number }[];
  semBanca: number;
}

export function montarListagem(
  caderno: Caderno,
  busca: URLSearchParams | Record<string, string | string[] | undefined>
): ListagemCaderno {
  const carga = carregarCaderno(caderno);
  const filtros = lerFiltros(busca);
  const itens = carga ? carga.itens : [];
  const acervo = removerCopiasIdenticas(itens);
  const filtrados = aplicarFiltros(acervo.itens, filtros);
  const pagina = calcularPagina(busca, filtrados.length);

  return {
    caderno,
    carga,
    filtros,
    pagina,
    acervo,
    filtrados,
    visiveis: fatiarPagina(filtrados, pagina),
    // As opções saem do acervo inteiro, nunca da página: o select não pode mudar
    // de tamanho conforme o filtro que o aluno acabou de aplicar. Cada faceta é
    // contada sem a restrição da própria faceta, então o número ao lado do rótulo
    // é exatamente o que o clique devolve.
    opcoes: opcoesDoContexto(acervo.itens, filtros),
    abas: totaisDasAbas(acervo.itens, filtros),
    refinamentos: refinamentosDoContexto(acervo.itens, filtros),
    facetas: facetas(acervo.itens),
    assuntos: contagemPorAssunto(acervo.itens),
    semBanca: semFaceta(acervo.itens, "banca"),
  };
}

/** O que a tela mostra como "banco" quando não há banco lido. */
export interface EstadoBanco {
  /** `knowledge_subjects.id` quando a matéria canônica existe no catálogo. */
  subjectId: string | null;
  publicas: number | null;
  erro: string | null;
}

/**
 * Contagem publicada da matéria canônica, com a mesma exclusão de fixtura da
 * listagem do repositório.
 *
 * Falha de leitura não vira zero: `erro` preenchido faz a tela ocultar a
 * contagem, porque "0 publicadas" afirmaria algo que não foi medido.
 */
export async function estadoDoBanco(caderno: Caderno): Promise<EstadoBanco> {
  try {
    const subject = await KnowledgeSubjectRepository.findBySlug(caderno.slug);
    if (!subject) return { subjectId: null, publicas: null, erro: null };
    // A contagem vem do repositório de propósito: é a mesma regra de fixtura da
    // lista. Somar direto em `questions` diria "publicadas" contando o que um
    // teste inseriu.
    const total = await countPublicasDaMateria(subject.id);
    return { subjectId: subject.id, publicas: total, erro: null };
  } catch (error) {
    return {
      subjectId: null,
      publicas: null,
      erro: error instanceof Error ? error.message : "falha desconhecida",
    };
  }
}
