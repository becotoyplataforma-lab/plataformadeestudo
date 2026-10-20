/**
 * ConcursoAI — ApostilasService (orquestração da Fase 1 "Minhas Apostilas")
 *
 * Regras de negócio:
 * 1. A lista é sempre do usuário autenticado (posse definida aqui, nunca no client).
 * 2. Filtra por matéria (query param / join) e por concurso/trilha (metadata JSONB).
 * 3. Agrupa por matéria, deduplicando associações N:M; "Sem matéria" vai por último.
 * 4. A leitura do binário usa o StorageAdapter — o DTO nunca expõe storage_path.
 *
 * Segue: specs/knowledge-apostilas.md, .ai/04-CODING-RULES.md (Service orquestra, Repo consultado)
 */
import {
  SEM_MATERIA_ID,
  SEM_MATERIA_NOME,
  toApostilaDtoList,
  toApostilasListaDtoStrict,
  type ApostilaDto,
  type ApostilasListaDto,
  type MateriaApostilasDto,
} from "@/lib/dto/apostilas.dto";
import { getStorage } from "@/lib/storage";
import type { StorageRange, StorageStream } from "@/lib/storage/types";
import { parseByteRange } from "@/lib/validations/apostilas";
import { ApostilasRepository, type ApostilaFilter } from "../repositories/apostilas.repository";

export interface ListarApostilasInput extends ApostilaFilter {
  userId: string;
  /** Filtro por concurso/trilha (documents.metadata). */
  concurso?: string;
}

export interface ApostilaArquivo {
  id: string;
  title: string;
  /** Nome sugerido para download (sanitizado). */
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  stream: StorageStream;
}

/** Resultado da abertura de um arquivo (a rota traduz para 200/206/416). */
export type ApostilaLeitura =
  | { status: "ok"; range: StorageRange | null; arquivo: ApostilaArquivo }
  | { status: "range_nao_satisfeita"; tamanhoTotal: number };

const DEFAULT_MIME_TYPE = "application/octet-stream";

/** Compara nomes em pt-BR (acentos ignorados na ordenação). */
function compareNomes(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
}

/**
 * Agrupa apostilas (já deduplicadas por id) em matérias ordenadas.
 * Pureza proposital: testável sem banco (tests/knowledge/apostilas.service.test.ts).
 */
export function agruparPorMateria(apostilas: ApostilaDto[]): MateriaApostilasDto[] {
  const grupos = new Map<string, MateriaApostilasDto>();

  for (const apostila of apostilas) {
    const materiaId = apostila.materia_id ?? SEM_MATERIA_ID;
    const existente = grupos.get(materiaId);

    if (existente) {
      if (!existente.apostilas.some((item) => item.id === apostila.id)) {
        existente.apostilas.push(apostila);
      }
      continue;
    }

    grupos.set(materiaId, {
      materia_id: materiaId,
      materia_nome: apostila.materia_nome ?? SEM_MATERIA_NOME,
      materia_cor: apostila.materia_cor ?? null,
      total: 0,
      apostilas: [apostila],
    });
  }

  const materias = [...grupos.values()].map((grupo) => ({
    ...grupo,
    total: grupo.apostilas.length,
  }));

  return materias.sort((a, b) => {
    if (a.materia_id === b.materia_id) return 0;
    if (a.materia_id === SEM_MATERIA_ID) return 1;
    if (b.materia_id === SEM_MATERIA_ID) return -1;
    return compareNomes(a.materia_nome, b.materia_nome);
  });
}

/** Concursos/trilhas distintos presentes na lista (para o filtro do cabeçalho). */
export function extrairConcursos(apostilas: ApostilaDto[]): string[] {
  const nomes = new Set<string>();
  for (const apostila of apostilas) {
    if (apostila.concurso) nomes.add(apostila.concurso);
  }
  return [...nomes].sort(compareNomes);
}

/** Nome de download seguro (sem controle de estado, aspas ou caminhos), sem extensão duplicada. */
export function nomeArquivoDownload(title: string, storagePath: string): string {
  const extMatch = storagePath.match(/\.[a-z0-9]+$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : ".pdf";
  const base = title
    .replace(/[\u0000-\u001f"\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.[a-z0-9]+$/i, "")
    .slice(0, 120);
  return `${base || "apostila"}${ext}`;
}

export const ApostilasService = {
  /** Lista + agrupa as apostilas do usuário segundo os filtros recebidos. */
  async listar(input: ListarApostilasInput): Promise<ApostilasListaDto> {
    const rows = await ApostilasRepository.listByUser(input.userId, {
      materiaId: input.materiaId,
      busca: input.busca,
    });

    let apostilas = toApostilaDtoList(rows);
    if (input.concurso) {
      const alvo = input.concurso.toLowerCase();
      apostilas = apostilas.filter(
        (apostila) => apostila.concurso?.toLowerCase() === alvo
      );
    }

    const materias = agruparPorMateria(apostilas);

    // Associação N:M: a mesma apostila pode aparecer em várias matérias.
    // As contagens são sempre de documentos DISTINTOS.
    const idsDistintos = new Set(apostilas.map((apostila) => apostila.id));

    return toApostilasListaDtoStrict({
      usuario_id: input.userId,
      total_apostilas: idsDistintos.size,
      total_materias: materias.length,
      concursos: extrairConcursos(apostilas),
      materias,
    });
  },

  /**
   * Abre o binário de uma apostila através do StorageAdapter.
   * - `null` se a apostila não existe ou não é do usuário (a rota devolve 404).
   * - O header Range é validado contra `documents.file_size`; sem tamanho
   *   registado a leitura é sempre completa.
   * NOTA: `storagePath` não sai daqui para o cliente (.ai/08).
   */
  async abrirArquivo(
    userId: string,
    id: string,
    rangeHeader: string | null
  ): Promise<ApostilaLeitura | null> {
    const row = await ApostilasRepository.findOwnedById(userId, id);
    if (!row) return null;

    const parsed = parseByteRange(rangeHeader, row.fileSize ?? 0);
    if (parsed.kind === "unsatisfiable") {
      return { status: "range_nao_satisfeita", tamanhoTotal: row.fileSize ?? 0 };
    }

    const range = parsed.kind === "range" ? parsed.range : null;
    const stream = await getStorage().getStream(row.storagePath, range ?? undefined);

    return {
      status: "ok",
      range,
      arquivo: {
        id: row.id,
        title: row.title,
        fileName: nomeArquivoDownload(row.title, row.storagePath),
        mimeType: row.mimeType ?? stream.contentType ?? DEFAULT_MIME_TYPE,
        fileSize: row.fileSize ?? stream.contentLength,
        stream,
      },
    };
  },
};
