/**
 * ConcursoAI - Verificacao manual do pipeline de embeddings (busca vetorial)
 * ========================================================================
 *
 * Harness de diagnostico que REUTILIZA os componentes reais ja implementados
 * (NAO reimplementa nada):
 *   - src/lib/knowledge/embedding/client.ts -> embeddingClient.embed / dimension
 *   - src/lib/knowledge/services/hybrid-search.service.ts -> HybridSearchService.search
 *   - src/db/schema/knowledge.ts -> coluna `embeddings.embedding` (dimensao 1024)
 *
 * IMPORTANTE: os modulos de knowledge importam `server-only`, que lanca erro
 * fora do contexto React Server. Para rodar via tsx, use a condicao `react-server`:
 *
 *   npx tsx --conditions=react-server scripts/test-embeddings-flow.ts
 *
 * -----------------------------------------------------------------------------
 * COMO RODAR:
 * -----------------------------------------------------------------------------
 *
 *   npx tsx --conditions=react-server scripts/test-embeddings-flow.ts
 *   # opcional: --user-id <uuid>  (padrao: primeiro usuario de auth.users)
 *   # opcional: --query "texto"   (padrao: "Direito Constitucional: principios fundamentais")
 *
 * -----------------------------------------------------------------------------
 * O QUE FAZ (em ordem):
 *   1. Le EMBEDDING_API_URL e faz uma chamada real de teste com um texto curto.
 *   2. Imprime a dimensao real do vetor retornado.
 *   3. Compara com a dimensao esperada (1024) da coluna `embeddings.embedding`.
 *      -> "[OK] Dimensao compativel (1024 = 1024)" ou "[ERRO] INCOMPATIVEL..."
 *   4. Se compativel: busca um documento real processado (status "chunked" ou
 *      "indexed"), gera o embedding de uma pergunta de teste e roda
 *      HybridSearchService.search, imprimindo os top 3 resultados com scores.
 *   5. Resume se a busca vetorial retornou resultados relevantes ou caiu para
 *      FTS-only (imprime qual modo foi usado).
 * -----------------------------------------------------------------------------
 */
import { embeddingClient } from "@/lib/knowledge/embedding/client";
import { HybridSearchService } from "@/lib/knowledge/services/hybrid-search.service";
import { db } from "@/lib/db/drizzle";
import { authUsers } from "@/db/schema/identity";
import { documents } from "@/db/schema/knowledge";
import { and, eq, isNull, inArray } from "drizzle-orm";

// Carrega o .env (DATABASE_URL, EMBEDDING_API_URL, etc.) fora do contexto
// Next.js. Node >= 20.6 suporta process.loadEnvFile().
try {
  process.loadEnvFile();
} catch {
  // .env ausente: deixa o env.ts reportar o que falta.
}

// Dimensao esperada da coluna `embeddings.embedding` (src/db/schema/knowledge.ts).
const EXPECTED_DIMENSION = 1024;

// Texto curto de teste para a chamada real de embeddings.
const TEST_TEXT = "Direito Constitucional: principios fundamentais";

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

async function resolveUserId(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const [user] = await db
    .select({ id: authUsers.id, email: authUsers.email })
    .from(authUsers)
    .limit(1);
  if (!user) {
    throw new Error(
      "Nenhum usuario encontrado em auth.users. Passe --user-id <uuid>."
    );
  }
  console.log(`[INFO] Usuario de teste: ${user.id} (${user.email ?? "sem email"})`);
  return user.id;
}

async function main() {
  const args = parseArgs();
  const userId = await resolveUserId(args["user-id"]);
  const query = args["query"] ?? TEST_TEXT;

  console.log("\n=== 1. Chamada real ao servico de embeddings ===");
  console.log(`[INFO] EMBEDDING_API_URL configurado: ${embeddingClient.isConfigured()}`);
  console.log(`[INFO] Modelo: ${embeddingClient.model}`);
  console.log(`[INFO] Dimensao esperada (schema): ${EXPECTED_DIMENSION}`);
  console.log(`[INFO] Texto de teste: "${query}"`);

  if (!embeddingClient.isConfigured()) {
    console.log(
      "\n[ERRO] FALHOU: EMBEDDING_API_URL nao esta configurado. " +
        "Configure o endpoint BAAI/bge-m3 para habilitar a busca vetorial."
    );
    process.exit(1);
  }

  // 1. Chamada real de teste.
  let vectors: number[][];
  try {
    vectors = await embeddingClient.embed([query]);
  } catch (err) {
    console.error("\n[ERRO] FALHOU: erro ao chamar o servico de embeddings:", err);
    process.exit(1);
  }

  const realDimension = vectors[0]?.length ?? 0;
  console.log(`\n[OK] Vetor gerado com dimensao real: ${realDimension}`);

  // 2. Comparacao de dimensao.
  const compatible = realDimension === EXPECTED_DIMENSION;
  console.log(
    compatible
      ? `\n[OK] Dimensao compativel (${realDimension} = ${EXPECTED_DIMENSION})`
      : `\n[ERRO] INCOMPATIVEL: servico retornou ${realDimension}, mas a coluna ` +
        `embeddings.embedding espera ${EXPECTED_DIMENSION}.`
  );

  if (!compatible) {
    console.log(
      "\n[ERRO] FALHOU: dimensao incompativel - a busca vetorial falharia ao inserir " +
        "o vetor na coluna pgvector. Corrija EMBEDDING_DIMENSION ou o modelo."
    );
    process.exit(1);
  }

  // 3. Buscar um documento real processado (status "chunked" ou "indexed").
  console.log("\n=== 2. Buscar documento processado do usuario ===");
  const [doc] = await db
    .select({ id: documents.id, title: documents.title, status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        isNull(documents.deletedAt),
        inArray(documents.status, ["chunked", "indexed"])
      )
    )
    .limit(1);

  if (!doc) {
    console.log(
      "[INFO] Nenhum documento processado (status 'chunked'/'indexed') encontrado " +
        "para o usuario. A busca vetorial nao pode ser exercitada com dados reais."
    );
    console.log(
      "\n[AVISO] pipeline de embeddings OK (dimensao compativel), mas sem " +
        "documentos processados para validar a busca. Suba um documento e rode novamente."
    );
    process.exit(0);
  }

  console.log(`[INFO] Documento: ${doc.title} (status=${doc.status}, id=${doc.id})`);

  // 4. Rodar a busca hibrida real.
  console.log("\n=== 3. Busca hibrida (HybridSearchService.search) ===");
  console.log(`[INFO] Query: "${query}"`);

  const output = await HybridSearchService.search({
    query,
    userId,
    topK: 3,
  });

  console.log(`[INFO] Modo usado: ${output.vectorSearchEnabled ? "VETORIAL + FTS (hibrido)" : "FTS-only (fallback)"}`);
  console.log(`[INFO] totalHits=${output.totalHits}, queryTimeMs=${output.queryTimeMs}ms`);

  if (output.results.length === 0) {
    console.log(
      output.vectorSearchEnabled
        ? "\n[AVISO] Busca vetorial habilitada, mas nenhum resultado relevante encontrado."
        : "\n[AVISO] Busca caiu para FTS-only (sem embeddings para os documentos do usuario)."
    );
    process.exit(0);
  }

  console.log("\nTop 3 resultados:");
  output.results.forEach((r, i) => {
    console.log(
      `  ${i + 1}. [score=${r.score.toFixed(4)} | vector=${r.vectorScore.toFixed(4)} | fts=${r.ftsScore.toFixed(4)}] ` +
        `${r.documentTitle} - ${r.content.slice(0, 90)}...`
    );
  });

  // 5. Resumo.
  const relevant = output.results.some((r) => r.vectorScore > 0);
  console.log(
    relevant
      ? "\n[OK] PASSOU: busca vetorial retornou resultados relevantes (vectorScore > 0)."
      : "\n[AVISO] Busca retornou resultados apenas via FTS (vectorScore = 0). " +
        "Verifique se os embeddings foram gerados para os chunks do documento."
  );
}

main().catch((err) => {
  console.error("\n[ERRO] Erro inesperado:", err);
  process.exit(1);
});
