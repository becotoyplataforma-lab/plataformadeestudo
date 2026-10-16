/**
 * GET /api/health/storage - backend de storage ativo + status de IA (booleans).
 * Publico: so nomes de backend e booleans. Nada de chave, ref, bucket ou
 * string de conexao no payload.
 *
 * force-dynamic: sem isso o Next pre-rendera o handler no build e o
 * monitoramento passa a ler um JSON congelado com os valores de build.
 */
import { NextResponse } from "next/server";
import { storageBackend } from "@/lib/knowledge/storage.service";
import { StorageBackendError } from "@/lib/knowledge/storage/backend";
import { isR2Configured } from "@/lib/knowledge/storage/r2-storage.service";
import { embeddingClient } from "@/lib/knowledge/embedding/client";

export const dynamic = "force-dynamic";

/** String de ambiente vazia ou so espacos conta como nao configurado. */
function configured(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

export async function GET() {
  let backend: string | null = null;
  let backendError: string | null = null;
  try {
    backend = storageBackend();
  } catch (error) {
    // STORAGE_BACKEND ausente ou invalido e condicao de configuracao: o health
    // reporta o codigo em vez de devolver 500 para o monitoramento.
    backendError =
      error instanceof StorageBackendError
        ? error.code
        : "STORAGE_BACKEND_ERROR";
  }
  return NextResponse.json({
    storage: {
      backend,
      backendError,
      r2Configured: isR2Configured(),
    },
    ai: {
      deepseekConfigured: configured(process.env.DEEPSEEK_API_KEY),
      embeddingConfigured: embeddingClient.isConfigured(),
    },
  });
}
