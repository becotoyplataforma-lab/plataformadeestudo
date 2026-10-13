import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { CADERNOS, type Caderno, type ItemCaderno, type LoteProcedencia } from "./cadernos";
import { direcaoDataset } from "./diretorio-dataset";
import { PADRAO_ID_LOCAL } from "./rotas";
import type { QuestaoExtraida } from "./procedencia";

/**
 * ConcursoAI — Carregador dos lotes locais de um caderno (server-only).
 *
 * Um lote é o JSON que `agents/pdf_question_extractor` escreve fora do banco.
 * Ele é *procedência*: a identidade navegável continua sendo a matéria
 * (`Caderno.slug`), e o arquivo é declarado no catálogo — nunca derivado do
 * nome físico dentro do código de rota ou de menu. Quando o lote entra em
 * banco, esta leitura deixa de ser necessária: o caderno passa a ser servido
 * por `questions`.
 *
 * A resolução do diretório (e a precedência entre o nome genérico e o legado)
 * mora em `diretorio-dataset.ts`, porque também é lida pelo guarda de importação
 * e pelo script de import — não por este módulo de servidor.
 */

export { direcaoDataset } from "./diretorio-dataset";

/** Descarte por violação de forma, com o lote que o produziu (nunca em silêncio). */
export interface DescarteLote {
  lote: string;
  id: string;
  motivo: string;
}

export interface CargaCaderno {
  caderno: Caderno;
  itens: ItemCaderno[];
  descartadas: DescarteLote[];
  /** Lotes declarados no catálogo sem arquivo no diretório configurado. */
  ausentes: string[];
  origem: { caminho: string; bytes: number; arquivos: string[] };
}

/**
 * Validação de forma, não de conteúdo.
 *
 * Barreiras que importam para a UI não mostrar besteira: id no formato do
 * extrator, enunciado presente, alternativas objeto, gabarito letra A-E quando
 * existe e `explicacao` sempre `null` (comentário de terceiro não viaja neste
 * arquivo). Item que viole sai da lista e aparece no relatório de descartes;
 * ignorar em silêncio seria pior.
 */
function ehItem(q: unknown): q is QuestaoExtraida {
  if (!q || typeof q !== "object") return false;
  const item = q as Record<string, unknown>;
  if (typeof item.id_local !== "string" || !PADRAO_ID_LOCAL.test(item.id_local)) return false;
  if (typeof item.enunciado !== "string" || item.enunciado.length === 0) return false;
  if (!item.alternativas || typeof item.alternativas !== "object") return false;
  const gab = item.gabarito;
  if (gab !== null && typeof gab !== "string") return false;
  if (typeof gab === "string" && !/^[A-E]$/.test(gab)) return false;
  if (item.explicacao !== null) return false;
  return true;
}

function motivoDescarte(q: unknown): string {
  if (!q || typeof q !== "object") return "item não é objeto";
  const item = q as Record<string, unknown>;
  if (typeof item.id_local !== "string" || !PADRAO_ID_LOCAL.test(item.id_local)) {
    return "id_local fora do formato do extrator";
  }
  if (typeof item.enunciado !== "string" || item.enunciado.length === 0) return "enunciado ausente";
  if (!item.alternativas || typeof item.alternativas !== "object") return "alternativas ausentes";
  const gab = item.gabarito;
  if (typeof gab === "string" && !/^[A-E]$/.test(gab)) return "gabarito não é letra A-E";
  if (item.explicacao !== null) return "explicacao não-nula (vazamento de terceiro)";
  return "motivo não classificado";
}


/** Cache por caminho absoluto: o mesmo arquivo não é lido duas vezes por request. */
const cache = new Map<
  string,
  { itens: QuestaoExtraida[]; descartadas: DescarteLote[]; bytes: number }
>();

function carregarArquivo(caminho: string, lote: LoteProcedencia) {
  const emCache = cache.get(caminho);
  if (emCache) return emCache;
  const bruto = readFileSync(caminho, "utf-8");
  const lista: unknown[] = JSON.parse(bruto);
  const itens: QuestaoExtraida[] = [];
  const descartadas: DescarteLote[] = [];
  for (const item of Array.isArray(lista) ? lista : []) {
    if (ehItem(item)) {
      itens.push(item);
    } else {
      const id = (item as { id_local?: unknown })?.id_local;
      descartadas.push({
        lote: lote.origem,
        id: typeof id === "string" ? id : "(sem id)",
        motivo: motivoDescarte(item),
      });
    }
  }
  const carga = { itens, descartadas, bytes: Buffer.byteLength(bruto, "utf-8") };
  cache.set(caminho, carga);
  return carga;
}


/**
 * Lê todos os lotes declarados para o caderno.
 *
 * Devolve null quando não há diretório configurado ou nenhum arquivo do caderno
 * existe: a tela trata isso como "acervo local ausente" e continua servindo o
 * que estiver em banco, em vez de inventar conteúdo de exemplo.
 */
export function carregarCaderno(caderno: Caderno): CargaCaderno | null {
  const diretorio = direcaoDataset();
  if (!diretorio) return null;

  const itens: ItemCaderno[] = [];
  const descartadas: DescarteLote[] = [];
  const ausentes: string[] = [];
  const arquivos: string[] = [];
  let bytes = 0;

  for (const lote of caderno.lotes) {
    const caminho = join(diretorio.caminho, lote.arquivo);
    if (!existsSync(caminho)) {
      ausentes.push(lote.origem);
      continue;
    }
    const carga = carregarArquivo(caminho, lote);
    arquivos.push(lote.arquivo);
    bytes += carga.bytes;
    descartadas.push(...carga.descartadas);
    for (const questao of carga.itens) itens.push({ questao, lote });
  }

  if (arquivos.length === 0) return null;

  return {
    caderno,
    itens,
    descartadas,
    ausentes,
    origem: { caminho: diretorio.caminho, bytes, arquivos },
  };
}

/**
 * Busca um código local em qualquer caderno.
 *
 * O código (`A14-S01-001`) não carrega a matéria — é chave de lote —, então a
 * rota `/questoes/[codigo]` precisa varrer os cadernos para saber para qual
 * caderno voltar. `vizinhos` são os itens da mesma seção sem quarentena: são os
 * que sustentam "anterior/próxima" sem pular item não confiável.
 */
export function buscarQuestaoLocal(
  codigo: string
): { caderno: Caderno; item: ItemCaderno; vizinhos: ItemCaderno[] } | null {
  for (const caderno of CADERNOS) {
    const carga = carregarCaderno(caderno);
    if (!carga) continue;
    const item = carga.itens.find((i) => i.questao.id_local === codigo);
    if (!item) continue;
    const vizinhos = carga.itens.filter(
      (i) => i.questao.secao === item.questao.secao && !i.questao.quarantined
    );
    return { caderno, item, vizinhos };
  }
  return null;
}
