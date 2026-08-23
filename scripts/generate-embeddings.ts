/**
 * ConcursoAI - Gerar embeddings dos documentos pendentes (status 'chunked')
 * =========================================================================
 *
 * Usa o pipeline REAL (EmbeddingService.embedDocument) para gerar os vetores
 * dos chunks de documentos que estao em status 'chunked' (chunked mas nao
 * indexados). Nao insere nada direto no banco: delega ao servico de dominio.
 *
 * RODAR:
 *   npx tsx --conditions=react-server scripts/generate-embeddings.ts
 *   # opcional: --document-id <uuid>  (gera so para um documento)
 *
 * IMPORTANTE: usa import dinamico apos process.loadEnvFile() para que o
 * env.ts (src/lib/env.ts) leia o process.env ja populado com EMBEDDING_*.
 */
try {
  process.loadEnvFile();
} catch {
  // .env ausente: deixa o env.ts reportar o que falta.
}

// Forca este arquivo a ser um modulo (nao script global), evitando colisao de
// nomes (parseArgs/main) com outros scripts no mesmo compilacao tsc.
export {};

function parseArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = "true";
      }
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const { EmbeddingService } = await import(
    "@/lib/knowledge/services/embedding.service"
  );
  const { db } = await import("@/lib/db/drizzle");
  const { documents } = await import("@/db/schema/knowledge");
  const { and, eq, isNull, inArray } = await import("drizzle-orm");

  // 1. Selecionar documentos pendentes (status 'chunked').
  const pendingDocs = args["document-id"]
    ? await db
        .select({ id: documents.id, title: documents.title, status: documents.status })
        .from(documents)
        .where(
          and(
            eq(documents.id, args["document-id"]),
            isNull(documents.deletedAt)
          )
        )
    : await db
        .select({ id: documents.id, title: documents.title, status: documents.status })
        .from(documents)
        .where(
          and(
            isNull(documents.deletedAt),
            inArray(documents.status, ["chunked"])
          )
        );

  if (pendingDocs.length === 0) {
    console.log("[INFO] Nenhum documento em status 'chunked' para indexar.");
    return;
  }

  console.log(`[INFO] ${pendingDocs.length} documento(s) pendente(s) de indexacao:\n`);
  for (const d of pendingDocs) {
    console.log(`  - ${d.title} (status=${d.status}, id=${d.id})`);
  }

  // 2. Gerar embeddings via pipeline real.
  for (const doc of pendingDocs) {
    console.log(`\n=== Indexando: ${doc.title} ===`);
    try {
      const output = await EmbeddingService.embedDocument({ documentId: doc.id });
      console.log(
        `  [OK] model=${output.model} | gerados=${output.generatedCount} ` +
          `| cache=${output.cachedCount} | falhas=${output.failedCount}`
      );
      if (output.failedCount > 0) {
        const failed = output.results.filter((r) => r.status === "failed");
        for (const f of failed) {
          console.log(`  [ERRO] chunk ${f.chunkId}: ${f.error}`);
        }
      }
    } catch (err) {
      console.error(`  [ERRO] Falha ao indexar documento ${doc.id}:`, err);
    }
  }

  // 3. Resumo final.
  const { embeddings } = await import("@/db/schema/knowledge");
  const { count } = await import("drizzle-orm");
  const [total] = await db
    .select({ n: count() })
    .from(embeddings);
  console.log(`\n[INFO] Total de embeddings na tabela: ${total?.n ?? 0}`);
}

main().catch((err) => {
  console.error("\n[ERRO] Erro inesperado:", err);
  process.exit(1);
});
