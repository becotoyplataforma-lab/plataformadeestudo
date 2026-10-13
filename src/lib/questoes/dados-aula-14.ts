import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { QuestaoExtraida } from "./procedencia";

/**
 * ConcursoAI — Carregador do dataset da Aula 14 (server-only).
 *
 * O JSON é produto de `agents/pdf_question_extractor` e vive fora do
 * repositório (unidade de estudo do usuário). Não é material de bundle: se o
 * arquivo não existe, as páginas enxergam "dataset ausente" e nada mais, em
 * vez de quebrar a build ou servir conteúdo inventado.
 *
 * O caminho sai de `QUESTOES_AULA14_DIR`; o padrão é a pasta do Drive onde o
 * extrator grava.
 */

const ARQUIVO = "questoes_aula_14.json";
const PADRAO_DIR = join(
  "H:",
  "Meu Drive",
  "plataforma de estudo",
  "cbm-rj",
  "portugues",
  "questoes"
);

export function direcaoDataset(): string {
  return process.env.QUESTOES_AULA14_DIR || PADRAO_DIR;
}

export function caminhoDataset(): string {
  return join(direcaoDataset(), ARQUIVO);
}

/**
 * Validação de forma, não de conteúdo.
 *
 * Barreiras que importam para a UI não mostrar besteira: id no formato
 * `A14-S01-001`, gabarito sempre letra única quando presente, `explicacao`
 * sempre null (comentário de terceiro não viaja neste arquivo) e `isPublic`
 * false até revisão humana. Um item que viole isso sai da lista e aparece no
 * relatório de descartes, silenciosamente ignorado seria pior.
 */
export interface CargaDataset {
  questoes: QuestaoExtraida[];
  descartadas: { id: string; motivo: string }[];
  origem: { caminho: string; bytes: number };
}

function ehItem(q: unknown): q is QuestaoExtraida {
  if (!q || typeof q !== "object") return false;
  const item = q as Record<string, unknown>;
  if (typeof item.id_local !== "string" || !/^A\d{2}-S\d{2}-\d{3}$/.test(item.id_local)) {
    return false;
  }
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
  if (typeof item.id_local !== "string" || !/^A\d{2}-S\d{2}-\d{3}$/.test(item.id_local)) {
    return "id_local fora do formato A14-Sxx-nnn";
  }
  if (typeof item.enunciado !== "string" || item.enunciado.length === 0) {
    return "enunciado ausente";
  }
  if (!item.alternativas || typeof item.alternativas !== "object") {
    return "alternativas ausentes";
  }
  const gab = item.gabarito;
  if (typeof gab === "string" && !/^[A-E]$/.test(gab)) {
    return "gabarito não é letra A-E";
  }
  if (item.explicacao !== null) return "explicacao não-nula (vazamento de terceiro)";
  return "motivo não classificado";
}

let cache: CargaDataset | null = null;

export function carregarAula14(): CargaDataset | null {
  if (cache) return cache;
  const caminho = caminhoDataset();
  if (!existsSync(caminho)) return null;

  const bruto = readFileSync(caminho, "utf-8");
  const lista: unknown[] = JSON.parse(bruto);
  const questoes: QuestaoExtraida[] = [];
  const descartadas: { id: string; motivo: string }[] = [];

  for (const item of Array.isArray(lista) ? lista : []) {
    if (ehItem(item)) {
      questoes.push(item);
    } else {
      const id = (item as { id_local?: unknown })?.id_local;
      descartadas.push({ id: typeof id === "string" ? id : "(sem id)", motivo: motivoDescarte(item) });
    }
  }

  cache = {
    questoes,
    descartadas,
    origem: { caminho: dirname(caminho), bytes: Buffer.byteLength(bruto, "utf-8") },
  };
  return cache;
}

export function buscarAula14(idLocal: string): QuestaoExtraida | null {
  const carga = carregarAula14();
  if (!carga) return null;
  return carga.questoes.find((q) => q.id_local === idLocal) ?? null;
}

/** Seções na ordem do índice, com contagem de itens de cada uma. */
export function secoesAula14(): {
  secao: number;
  rotulo: string;
  tipo: string;
  total: number;
}[] {
  const carga = carregarAula14();
  if (!carga) return [];
  const porSecao = new Map<number, { secao: number; rotulo: string; tipo: string; total: number }>();
  for (const q of carga.questoes) {
    const atual = porSecao.get(q.secao) ?? {
      secao: q.secao,
      rotulo: q.secao_rotulo,
      tipo: q.secao_tipo,
      total: 0,
    };
    atual.total += 1;
    porSecao.set(q.secao, atual);
  }
  return [...porSecao.values()].sort((a, b) => a.secao - b.secao);
}
