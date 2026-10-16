/**
 * CatalogApplyService (FASE 4) - a porta de escrita do agente, fechada por decisao.
 *
 * Este arquivo nao importa db, Drizzle, Postgres, Supabase, repositorio de
 * escrita, storage nem rede. Ele existe para que um pedido de aplicacao tenha
 * resposta tipada e auditavel: sempre ok false, sempre applied false, sempre
 * databaseOperations vazio. Bandeira de bypass oferecida pelo caller e registrada
 * e recusada; nunca e honrada.
 */
import "server-only";
import type { CatalogApplyResult, CatalogConflict } from "../types/catalog-ingestion";

export const APPLY_DISABLED_CODE = "APPLY_DISABLED_IN_AUDIT_PHASE";
export const APPLY_DISABLED_MESSAGE =
  "FASE 4 e auditoria: o agente produz relatorio e nao escreve. Nenhuma bandeira habilita escrita sem nova fase aprovada.";

/** Nomes de bandeira que o caller pode tentar oferecer. Todos sao recusados. */
export const REFUSED_BYPASS_NAMES = [
  "apply",
  "force",
  "write",
  "writes",
  "execute",
  "commit",
  "persist",
  "migrate",
  "migration",
  "seed",
  "skipSafety",
  "skipGuard",
  "overwriteSnapshot",
  "dryRun",
];

export function refuseCatalogApply(bypass?: Record<string, unknown>): CatalogApplyResult {
  const keys = Object.keys(bypass ?? {}).sort();
  const refused: string[] = [];
  for (const key of keys) {
    const value = (bypass as Record<string, unknown>)[key];
    if (value === undefined || value === null || value === false) continue;
    refused.push(key);
  }
  return {
    ok: false,
    applied: false,
    code: APPLY_DISABLED_CODE,
    message: APPLY_DISABLED_MESSAGE,
    databaseOperations: [],
    refusedBypassFlags: refused,
    attemptedAt: new Date().toISOString(),
  };
}

/**
 * Conflito do proprio bloqueio. Informativo quando ninguem pediu escrita; de
 * revisao quando o caller ofereceu bandeira de bypass (tentativa documentada).
 */
export function applyConflictOf(result: CatalogApplyResult): CatalogConflict {
  const attempted = result.refusedBypassFlags.length !== 0;
  return {
    conflictId: "CNF-APPLY-01",
    code: APPLY_DISABLED_CODE,
    severity: attempted ? "review" : "informational",
    message: attempted
      ? "Pedido de escrita recusado: bandeiras de bypass registradas e nao honradas."
      : "Aplicacao permanece desligada nesta fase; nada foi escrito.",
    entities: attempted ? result.refusedBypassFlags : ["catalog-apply"],
    suggestion: attempted
      ? "Abrir nova fase aprovada, com banco de teste isolado, antes de qualquer escrita."
      : "Ler o relatorio e decidir o vocabulario; escrita so em fase futura.",
    autoFixed: false,
    detail: {
      code: result.code,
      applied: result.applied,
      databaseOperations: result.databaseOperations.length,
      refusedBypassFlags: result.refusedBypassFlags,
    },
  };
}
