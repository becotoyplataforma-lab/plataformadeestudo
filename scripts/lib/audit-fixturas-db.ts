/**
 * Auditoria de LEITURA do acervo publicado em banco: quanto é conteúdo e quanto
 * é fixtura de teste. Não escreve nada — a limpeza física é decisão humana com
 * banco de teste comprovadamente isolado (docs/31 §7.4).
 *
 * Uso:
 *   npx tsx --conditions=react-server scripts/lib/audit-fixturas-db.ts
 */
import { existsSync } from "node:fs";

// O ambiente vem de arquivo, como nos outros scripts do repo: o import do `db`
// precisa ser dinâmico porque ele congela `DATABASE_URL` na primeira importação.
for (const arquivo of [".env.local", ".env"]) {
  if (existsSync(arquivo)) process.loadEnvFile(arquivo);
}

async function main() {
  const { sql, isNull } = await import("drizzle-orm");
  const { db } = await import("@/lib/db/drizzle");
  const { questions } = await import("@/db/schema/study");
  const { knowledgeSubjects } = await import("@/db/schema/knowledge");
  const { listQuestions, listSubjects } = await import("@/lib/db/repositories/questoes");

  const publico = sql`${questions.isPublic} = true AND ${questions.status} = 'publicada' AND ${questions.deletedAt} IS NULL`;

  const [bruto] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(questions)
    .where(publico);

  const [fixtura] = await db
    .select({
      total: sql<number>`count(*)::int`,
      amostra: sql<string>`string_agg(${questions.enunciado}, ' | ')`,
    })
    .from(questions)
    .where(
      sql`${publico} AND (${questions.enunciado} ILIKE 'E2E %' OR ${questions.enunciado} IN ('Qual é a pergunta?', 'P?'))`
    );

  const visiveis = await listQuestions({ page: 1, pageSize: 100 });
  const materias = await listSubjects();
  // O total do catálogo sem o filtro de fixtura, para a tabela "antes/depois"
  // ser medida e não presumida.
  const [materiasBrutas] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(knowledgeSubjects)
    .where(isNull(knowledgeSubjects.deletedAt));

  console.log(
    JSON.stringify(
      {
        publicadasNoBanco: bruto?.total ?? 0,
        excluidasComoFixtura: fixtura?.total ?? 0,
        amostraExcluida: (fixtura?.amostra ?? "").slice(0, 240),
        visiveisAoAluno: visiveis.total,
        materiasNoCatalogo: materiasBrutas?.total ?? 0,
        materiasNoCatalogoAposFiltro: materias.length,
        primeirasVisiveis: visiveis.data.slice(0, 5).map((q) => q.enunciado.slice(0, 60)),
      },
      null,
      2
    )
  );
}

main().catch((erro) => {
  console.error("AUDITORIA_FALHOU", erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});

