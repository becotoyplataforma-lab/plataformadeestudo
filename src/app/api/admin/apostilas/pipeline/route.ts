/**
 * GET /api/admin/apostilas/pipeline
 *
 * Fila de conversao das apostilas: em que estagio esta cada documento e o que
 * ficou pendente de indexacao ou falhou. Somente leitura: nao reprocessa, nao
 * grava e nao apaga nada do corpus.
 *
 * Responde as duas perguntas que hoje so se conseguiam no banco:
 *   1. o material entrou e virou trecho pesquisavel? (chunked / indexed)
 *   2. o que esta parado, e por que? (pending / processing / failed)
 *
 * A resposta leva um DTO estreito de proposito: storage_path, file_hash e
 * user_id ficam fora porque a fila nao precisa deles, e cada um e um
 * identificador interno que vazaria ao cliente sem nenhuma utilidade.
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/administration/session";
import {
  AdminGuardService,
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import {
  DocumentRepository,
  PIPELINE_STATUSES,
  type PipelineStatus,
} from "@/lib/knowledge/repositories/document.repository";

// A fila reflete o banco no momento do pedido. Sem esta linha o Next
// pre-renderiza as contagens no build e o monitoramento passaria a ler
// numeros congelados - o mesmo problema ja resolvido nas rotas de health.
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_ERROR_LENGTH = 300;

/** Estados que significam "ainda nao virou conteudo pesquisavel". */
const AWAITING_INDEXING: readonly PipelineStatus[] = [
  "pending",
  "processing",
  "chunked",
];

const FAILED: readonly PipelineStatus[] = ["failed"];

function parseLimit(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(parsed));
}

type QueueRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  chunk_count: number;
  embedding_count: number;
  page_count: number | null;
  updated_at: string;
  processing_error?: string;
};

function toQueueRow(row: {
  id: string;
  title: string;
  type: string;
  status: string;
  chunkCount: number;
  embeddingCount: number;
  pageCount: number | null;
  updatedAt: Date;
  processingError: string | null;
}): QueueRow {
  const dto: QueueRow = {
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    chunk_count: row.chunkCount,
    embedding_count: row.embeddingCount,
    page_count: row.pageCount,
    updated_at: row.updatedAt.toISOString(),
  };
  // processing_error contem o texto que o proprio pipeline gravou. Continua
  // util para diagnosticar e por isso aparece aqui, cortado e so nesta rota
  // exclusiva de admin.
  if (row.processingError) {
    dto.processing_error = row.processingError.slice(0, MAX_ERROR_LENGTH);
  }
  return dto;
}

export async function GET(request: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }
    await AdminGuardService.requireAdmin(admin);

    const limit = parseLimit(new URL(request.url).searchParams.get("limit"));

    const [counts, awaitingRows, failedRows] = await Promise.all([
      DocumentRepository.countByPipelineStatus(),
      DocumentRepository.listByPipelineStatuses(AWAITING_INDEXING, limit),
      DocumentRepository.listByPipelineStatuses(FAILED, limit),
    ]);

    const byStatus: Record<string, number> = {};
    for (const status of PIPELINE_STATUSES) byStatus[status] = 0;
    let total = 0;
    for (const row of counts) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + row.count;
      total += row.count;
    }

    return NextResponse.json({
      counts: { ...byStatus, total },
      awaiting_indexing: awaitingRows.map(toQueueRow),
      failed: failedRows.map(toQueueRow),
      limit,
      searchable_statuses: ["chunked", "indexed"],
      note:
        "chunked = conteudo pronto e pesquisavel por FTS, busca vetorial pendente. Isso nao e falha.",
    });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 403 }
      );
    }
    console.error("[admin/apostilas/pipeline] GET", error);
    return NextResponse.json(
      {
        error: "PIPELINE_QUEUE_UNAVAILABLE",
        message: "Falha ao ler a fila de processamento.",
      },
      { status: 500 }
    );
  }
}
