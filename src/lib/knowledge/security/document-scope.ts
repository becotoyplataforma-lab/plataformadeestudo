import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { editais, positions } from "@/db/schema/contest";

/**
 * Validacao do escopo de curso informado no upload (individual ou em lote).
 *
 * position_id e edital_id nunca sao aceitos no chute: precisam existir, nao
 * estar excluidos e pertencer ao mesmo concurso. Quando o cargo tem edital
 * proprio e o upload nao informou edital, o edital do cargo e reaproveitado -
 * isso e relacao que ja esta no banco, nao invengao de dados.
 *
 * Retorna sempre o escopo efetivo a gravar em documents, para que rota de
 * upload e rota de lote gravem exatamente a mesma coisa.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ScopeErrorCode =
  | "INVALID_SCOPE_ID"
  | "SCOPE_NOT_FOUND"
  | "SCOPE_MISMATCH";

export class ScopeError extends Error {
  constructor(
    public readonly code: ScopeErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ScopeError";
  }
}

export interface ResolvedDocumentScope {
  positionId: string | null;
  editalId: string | null;
}

function normalizeId(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function validateDocumentScope(input: {
  positionId?: string | null;
  editalId?: string | null;
}): Promise<ResolvedDocumentScope> {
  const positionId = normalizeId(input.positionId);
  const editalId = normalizeId(input.editalId);

  if (!positionId && !editalId) return { positionId: null, editalId: null };

  if (positionId && !UUID_RE.test(positionId)) {
    throw new ScopeError("INVALID_SCOPE_ID", "Cargo invalido: identificador em formato inesperado.");
  }
  if (editalId && !UUID_RE.test(editalId)) {
    throw new ScopeError("INVALID_SCOPE_ID", "Edital invalido: identificador em formato inesperado.");
  }

  let positionRow: { id: string; contestId: string; editalId: string | null } | null = null;
  let editalRow: { id: string; contestId: string } | null = null;

  if (positionId) {
    const [row] = await db
      .select({
        id: positions.id,
        contestId: positions.contestId,
        editalId: positions.editalId,
      })
      .from(positions)
      .where(and(eq(positions.id, positionId), isNull(positions.deletedAt)))
      .limit(1);
    if (!row) throw new ScopeError("SCOPE_NOT_FOUND", "Cargo informado nao existe ou foi excluido.");
    positionRow = row;
  }

  if (editalId) {
    const [row] = await db
      .select({ id: editais.id, contestId: editais.contestId })
      .from(editais)
      .where(and(eq(editais.id, editalId), isNull(editais.deletedAt)))
      .limit(1);
    if (!row) throw new ScopeError("SCOPE_NOT_FOUND", "Edital informado nao existe ou foi excluido.");
    editalRow = row;
  }

  if (positionRow && editalRow && positionRow.contestId !== editalRow.contestId) {
    throw new ScopeError(
      "SCOPE_MISMATCH",
      "Edital e cargo pertencem a concursos diferentes; o vinculo foi recusado."
    );
  }

  return {
    positionId,
    editalId: editalId ?? positionRow?.editalId ?? null,
  };
}