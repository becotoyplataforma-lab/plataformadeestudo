import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";

const BASE_DIR = fs.existsSync(path.resolve("plataformadeestudo/dataset"))
  ? path.resolve("plataformadeestudo")
  : path.resolve(".");

const MATEMATICA_SUBJECT_ID = "95bb8b59-60ad-4c52-bf05-bc718cbb6353";
const PORTUGUES_SUBJECT_ID = "aaaaaaaa-0000-4000-8000-000000000001";

function calcularHash(subjectId, enunciado, alternativas) {
  const normEnunciado = (enunciado || "").trim().toLowerCase();
  const normAlts = Object.entries(alternativas || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letra, texto]) => `${letra}:${(texto || "").trim().toLowerCase()}`)
    .join("|");
  return crypto.createHash("sha256").update(`${subjectId}::${normEnunciado}::${normAlts}`).digest("hex");
}

function processarLote(questoesRaw, subjectId, materiaNome) {
  const validas = [];
  const hashesVistos = new Set();

  for (const q of questoesRaw) {
    const enunciado = (q.enunciado || "").trim();
    if (!enunciado) continue;

    const gabarito = (q.gabarito || "").trim().toUpperCase();
    if (!/^[A-E]$/.test(gabarito)) continue;

    const alts = q.alternativas || {};
    const keys = Object.keys(alts);
    if (keys.length < 2) continue;

    const hash = calcularHash(subjectId, enunciado, alts);
    if (hashesVistos.has(hash)) continue;
    hashesVistos.add(hash);

    let ano = null;
    if (typeof q.ano === "number" && q.ano >= 1990 && q.ano <= 2030) {
      ano = q.ano;
    } else if (typeof q.ano === "string") {
      const parsedAno = parseInt(q.ano, 10);
      if (!isNaN(parsedAno) && parsedAno >= 1990 && parsedAno <= 2030) ano = parsedAno;
    }

    validas.push({
      knowledge_subject_id: subjectId,
      banca: q.banca || null,
      cargo: q.cargo || null,
      ano,
      nivel: "medio",
      enunciado,
      gabarito,
      explicacao: q.explicacao || null,
      tipo: keys.length === 2 && keys.includes("C") && keys.includes("E") ? "certo_errado" : "multipla_escolha",
      fonte: `CBM-RJ / ${materiaNome} - Aula ${q.aula !== undefined ? String(q.aula).padStart(2, "0") : "Geral"}`,
      origin: "import",
      is_public: true,
      content_hash: hash,
      status: "publicada",
      topic: q.assunto || q.tema || null,
      alternativas: alts,
    });
  }

  return validas;
}

async function run() {
  console.log("=== MIGRAÇÃO OTIMIZADA DE QUESTÕES PARA O SUPABASE ===");

  const matPath = path.join(BASE_DIR, "dataset/questoes/questoes_matematica.json");
  const portPath = path.join(BASE_DIR, "dataset/questoes/questoes_aula_14.json");

  const matRaw = fs.existsSync(matPath) ? JSON.parse(fs.readFileSync(matPath, "utf-8")) : [];
  const portRaw = fs.existsSync(portPath) ? JSON.parse(fs.readFileSync(portPath, "utf-8")) : [];

  const matValidas = processarLote(matRaw, MATEMATICA_SUBJECT_ID, "Matemática");
  const portValidas = processarLote(portRaw, PORTUGUES_SUBJECT_ID, "Português");

  console.log(`Matemática: ${matValidas.length} questões válidas prontas.`);
  console.log(`Português:  ${portValidas.length} questões válidas prontas.`);
  console.log(`Total:      ${matValidas.length + portValidas.length} questões.`);

  const sql = postgres(process.env.DATABASE_URL, { max: 10 });

  try {
    const todosLotes = [
      { nome: "Matemática", lista: matValidas },
      { nome: "Português", lista: portValidas },
    ];

    for (const { nome, lista } of todosLotes) {
      console.log(`\nIniciando carga em massa de ${nome}...`);
      const batchSize = 100;
      let totalGravadas = 0;

      for (let i = 0; i < lista.length; i += batchSize) {
        const batch = lista.slice(i, i + batchSize);

        // Prepara rows para questions
        const questionsToInsert = [];
        const optionsToInsert = [];

        for (const item of batch) {
          const qId = crypto.randomUUID();
          questionsToInsert.push({
            id: qId,
            knowledge_subject_id: item.knowledge_subject_id,
            banca: item.banca,
            cargo: item.cargo,
            ano: item.ano,
            nivel: item.nivel,
            enunciado: item.enunciado,
            gabarito: item.gabarito,
            explicacao: item.explicacao,
            tipo: item.tipo,
            fonte: item.fonte,
            origin: item.origin,
            is_public: item.is_public,
            content_hash: item.content_hash,
            status: item.status,
            topic: item.topic,
          });

          for (const [letra, texto] of Object.entries(item.alternativas)) {
            const isCorrect = letra.trim().toUpperCase() === item.gabarito;
            optionsToInsert.push({
              id: crypto.randomUUID(),
              question_id: qId,
              letter: letra.trim().toUpperCase(),
              text: (texto || "").trim() || `Opção ${letra}`,
              is_correct: isCorrect,
            });
          }
        }

        // Executa insert em lote das questões retornando IDs inseridos
        await sql.begin(async (tx) => {
          const inserted = await tx`
            INSERT INTO questions ${tx(
              questionsToInsert,
              "id",
              "knowledge_subject_id",
              "banca",
              "cargo",
              "ano",
              "nivel",
              "enunciado",
              "gabarito",
              "explicacao",
              "tipo",
              "fonte",
              "origin",
              "is_public",
              "content_hash",
              "status",
              "topic"
            )}
            ON CONFLICT (content_hash) WHERE deleted_at IS NULL DO NOTHING
            RETURNING id
          `;

          const insertedSet = new Set(inserted.map((r) => r.id));
          const validOptions = optionsToInsert.filter((opt) => insertedSet.has(opt.question_id));

          if (validOptions.length > 0) {
            await tx`
              INSERT INTO question_options ${tx(
                validOptions,
                "id",
                "question_id",
                "letter",
                "text",
                "is_correct"
              )}
            `;
          }

          totalGravadas += inserted.length;
        });

        const pct = Math.min(100, Math.round(((i + batch.length) / lista.length) * 100));
        process.stdout.write(`\r[${nome}] ${i + batch.length}/${lista.length} (${pct}%) | Gravadas no banco: ${totalGravadas}`);
      }

      console.log(`\n[${nome}] Carga concluída: ${totalGravadas} questões salvas.`);
    }

    const totalBanco = await sql`SELECT count(*) FROM questions`;
    const totalOpcoes = await sql`SELECT count(*) FROM question_options`;
    console.log(`\n======================================================`);
    console.log(`TOTAL DE QUESTÕES NO SUPABASE:    ${totalBanco[0].count}`);
    console.log(`TOTAL DE ALTERNATIVAS NO SUPABASE: ${totalOpcoes[0].count}`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error("Erro na carga em massa:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
