import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

// Configurações R2
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME || "plataforma";
const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

const s3Client = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

const BASE_DIR = fs.existsSync(path.resolve("plataformadeestudo/public"))
  ? path.resolve("plataformadeestudo")
  : path.resolve(".");
const ADMIN_USER_ID = "d8312f5f-af1a-42c2-a007-740b79a2c269"; // becotoy@gmail.com
const MATEMATICA_SUBJECT_ID = "95bb8b59-60ad-4c52-bf05-bc718cbb6353";
const PORTUGUES_SUBJECT_ID = "aaaaaaaa-0000-4000-8000-000000000001";

async function uploadToR2(filePath, r2Key, contentType) {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  try {
    const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: r2Key }));
    if (head.ContentLength === fileBuffer.length) {
      console.log(`[R2] Já existe em R2 (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB): ${r2Key}`);
      return { hash, size: fileBuffer.length };
    }
  } catch (e) {
    // Objeto não existe, prosseguir com upload
  }

  console.log(`[R2] Enviando ${path.basename(filePath)} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB) -> ${r2Key}...`);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: {
        sha256: hash,
        concurso: "CBM-RJ",
      },
    })
  );
  console.log(`[R2] OK: ${r2Key}`);
  return { hash, size: fileBuffer.length };
}

async function run() {
  console.log("=== INICIANDO MIGRAÇÃO DE APOSTILAS PARA R2 E SUPABASE ===");
  const sql = postgres(process.env.DATABASE_URL, { max: 2 });

  try {
    // 1. Catálogo de Matemática (20 aulas)
    const matCatalogoPath = path.join(BASE_DIR, "dataset/matematica_aulas_catalogo.json");
    const matCatalogo = fs.existsSync(matCatalogoPath)
      ? JSON.parse(fs.readFileSync(matCatalogoPath, "utf-8"))
      : [];

    console.log(`\n--- Processando 20 Apostilas de Matemática ---`);
    for (let i = 0; i <= 19; i++) {
      const num = String(i).padStart(2, "0");
      const pdfName = `CBM-RJ_Matematica_Aula_${num}_Adaptada.pdf`;
      const pdfPath = path.join(BASE_DIR, "public/apostilas-adaptadas", pdfName);
      const previewName = `matematica-aula-${num}-preview.html`;
      const previewPath = path.join(BASE_DIR, "public/preview", previewName);

      const info = matCatalogo.find((c) => c.aula === num) || {};
      const title = info.titulo ? `Matemática - Aula ${num}: ${info.titulo}` : `Matemática - Aula ${num}`;

      if (!fs.existsSync(pdfPath)) {
        console.warn(`[AVISO] PDF não encontrado: ${pdfPath}`);
        continue;
      }

      // Upload do PDF para R2
      const r2PdfKey = `apostilas/cbm-rj/matematica/${pdfName}`;
      const pdfUpload = await uploadToR2(pdfPath, r2PdfKey, "application/pdf");

      // Upload do Preview HTML para R2 (se existir)
      let r2PreviewKey = null;
      if (fs.existsSync(previewPath)) {
        r2PreviewKey = `apostilas/cbm-rj/previews/${previewName}`;
        await uploadToR2(previewPath, r2PreviewKey, "text/html; charset=utf-8");
      }

      // Registro no Supabase (documents) - UUID válido em hexadecimal (b0000000...)
      const docId = `b0000000-0000-4000-8000-0000000000${num}`;
      const metadata = {
        concurso: "CBM-RJ",
        materia: "Matemática",
        aula: num,
        total_paginas: info.paginas || 0,
        topicos: info.topicos || [],
        r2_key: r2PdfKey,
        r2_preview_key: r2PreviewKey,
        preview_url: `/preview/${previewName}`,
        download_url: `/api/apostilas/download?materia=matematica&aula=${num}`,
      };

      await sql`
        INSERT INTO documents (
          id, user_id, type, title, storage_path, storage_backend,
          status, file_size, mime_type, file_hash, metadata, created_at, updated_at
        ) VALUES (
          ${docId}, ${ADMIN_USER_ID}, 'pdf', ${title}, ${r2PdfKey}, 'r2',
          'indexed', ${pdfUpload.size}, 'application/pdf', ${pdfUpload.hash}, ${metadata}, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          storage_path = EXCLUDED.storage_path,
          storage_backend = EXCLUDED.storage_backend,
          status = EXCLUDED.status,
          file_size = EXCLUDED.file_size,
          file_hash = EXCLUDED.file_hash,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `;

      // Vincular matéria em document_subjects
      await sql`
        INSERT INTO document_subjects (document_id, subject_id)
        VALUES (${docId}, ${MATEMATICA_SUBJECT_ID})
        ON CONFLICT DO NOTHING
      `;

      console.log(`[Supabase] Documento Aula ${num} registrado com sucesso (ID: ${docId})`);
    }

    // 2. Catálogo de Português (13 aulas)
    console.log(`\n--- Processando 13 Apostilas de Língua Portuguesa ---`);
    for (let i = 1; i <= 13; i++) {
      const num = String(i).padStart(2, "0");
      const pdfName = `CBM-RJ_Portugues_Aula_${num}_Adaptada.pdf`;
      let pdfPath = path.join(BASE_DIR, "public/apostilas-adaptadas", pdfName);
      if (!fs.existsSync(pdfPath)) {
        pdfPath = path.join(BASE_DIR, "public/apostilas-adaptadas", `aula-${num}-adaptada.pdf`);
      }

      const previewName = `aula-${num}-preview.html`;
      const previewPath = path.join(BASE_DIR, "public/preview", previewName);

      if (!fs.existsSync(pdfPath)) {
        console.warn(`[AVISO] PDF Português não encontrado: ${pdfPath}`);
        continue;
      }

      const r2PdfKey = `apostilas/cbm-rj/portugues/${pdfName}`;
      const pdfUpload = await uploadToR2(pdfPath, r2PdfKey, "application/pdf");

      let r2PreviewKey = null;
      if (fs.existsSync(previewPath)) {
        r2PreviewKey = `apostilas/cbm-rj/previews/${previewName}`;
        await uploadToR2(previewPath, r2PreviewKey, "text/html; charset=utf-8");
      }

      const docId = `a0000000-0000-4000-8000-0000000000${num}`;
      const title = `Língua Portuguesa - Aula ${num}`;
      const metadata = {
        concurso: "CBM-RJ",
        materia: "Língua Portuguesa",
        aula: num,
        r2_key: r2PdfKey,
        r2_preview_key: r2PreviewKey,
        preview_url: `/preview/${previewName}`,
        download_url: `/api/apostilas/download?materia=portugues&aula=${num}`,
      };

      await sql`
        INSERT INTO documents (
          id, user_id, type, title, storage_path, storage_backend,
          status, file_size, mime_type, file_hash, metadata, created_at, updated_at
        ) VALUES (
          ${docId}, ${ADMIN_USER_ID}, 'pdf', ${title}, ${r2PdfKey}, 'r2',
          'indexed', ${pdfUpload.size}, 'application/pdf', ${pdfUpload.hash}, ${metadata}, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          storage_path = EXCLUDED.storage_path,
          storage_backend = EXCLUDED.storage_backend,
          status = EXCLUDED.status,
          file_size = EXCLUDED.file_size,
          file_hash = EXCLUDED.file_hash,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `;

      await sql`
        INSERT INTO document_subjects (document_id, subject_id)
        VALUES (${docId}, ${PORTUGUES_SUBJECT_ID})
        ON CONFLICT DO NOTHING
      `;

      console.log(`[Supabase] Documento Português Aula ${num} registrado com sucesso (ID: ${docId})`);
    }

    console.log("\n=== MIGRAÇÃO DE APOSTILAS CONCLUÍDA COM SUCESSO! ===");
  } catch (err) {
    console.error("Erro fatal na migração de apostilas:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
