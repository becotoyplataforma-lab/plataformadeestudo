import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { AdminGuardService } from "@/lib/administration/services/admin-guard.service";
import { DEMO_APOSTILAS_LISTA } from "@/lib/constants/demo-apostilas";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function sanitizeString(str: unknown, maxLen = 120): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/[<>'"\\]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLen);
}

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticação obrigatória
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Autorização: apenas administradores e professores podem enviar apostilas
    const canUpload = await AdminGuardService.isProfessorOrAdmin(
      session.user.email
    ).catch(() => false);

    if (!canUpload) {
      return NextResponse.json(
        {
          error: "FORBIDDEN",
          message: "Apenas administradores e professores podem enviar apostilas.",
        },
        { status: 403 }
      );
    }

    // 3. Validação dos dados do formulário
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const rawTitulo = formData.get("titulo");
    const rawConcurso = formData.get("concurso");
    const rawMateria = formData.get("materia");

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    // 4. Limite de tamanho de arquivo (máximo 50MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. O limite máximo é 50 MB." },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 5. Validação de Magic Bytes (%PDF-)
    if (buffer.length < 5 || buffer.subarray(0, 4).toString("latin1") !== "%PDF") {
      return NextResponse.json(
        { error: "Formato de arquivo inválido. O arquivo deve ser um documento PDF autêntico." },
        { status: 400 }
      );
    }

    // 6. Sanitização de nome e entradas textuais
    const safeBaseName = path.basename(file.name).replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const safeExt = safeBaseName.endsWith(".pdf") ? "" : ".pdf";
    const id = crypto.randomUUID();
    const fileName = `${id}-${safeBaseName}${safeExt}`;

    const titulo = sanitizeString(rawTitulo) || "Nova Apostila";
    const concurso = sanitizeString(rawConcurso) || "CBM-RJ";
    const materiaNome = sanitizeString(rawMateria) || "Língua Portuguesa";

    // 7. Salva em .storage/apostilas para persistência estruturada e segura
    const storageDir = path.join(process.cwd(), ".storage", "apostilas", userId, id);
    fs.mkdirSync(storageDir, { recursive: true });
    fs.writeFileSync(path.join(storageDir, fileName), buffer);

    // 8. Salva em public/apostilas para acesso imediato no leitor web
    const publicApostilasDir = path.join(process.cwd(), "public", "apostilas");
    fs.mkdirSync(publicApostilasDir, { recursive: true });
    const publicFilePath = path.join(publicApostilasDir, fileName);
    fs.writeFileSync(publicFilePath, buffer);

    // 9. Registra a nova apostila no catálogo
    const novaApostila = {
      id,
      titulo,
      tipo: "pdf" as const,
      status: "indexed" as const,
      tamanho_bytes: buffer.byteLength,
      mime_type: "application/pdf",
      concurso,
      materia_id: "b3000000-0000-4000-8000-000000000003",
      materia_nome: materiaNome,
      materia_cor: "#3b82f6",
      arquivo_url: `/apostilas/${fileName}`,
      criado_em: new Date().toISOString(),
    };

    let materiaGrupo = DEMO_APOSTILAS_LISTA.materias.find(
      (m) => m.materia_nome.toLowerCase() === materiaNome.toLowerCase()
    );

    if (!materiaGrupo) {
      materiaGrupo = {
        materia_id: crypto.randomUUID(),
        materia_nome: materiaNome,
        materia_cor: "#10b981",
        total: 0,
        apostilas: [],
      };
      DEMO_APOSTILAS_LISTA.materias.push(materiaGrupo);
    }

    materiaGrupo.apostilas.unshift(novaApostila);
    materiaGrupo.total = materiaGrupo.apostilas.length;
    DEMO_APOSTILAS_LISTA.total_apostilas = DEMO_APOSTILAS_LISTA.materias.reduce(
      (acc, m) => acc + m.apostilas.length,
      0
    );

    if (!DEMO_APOSTILAS_LISTA.concursos.includes(concurso)) {
      DEMO_APOSTILAS_LISTA.concursos.push(concurso);
    }

    return NextResponse.json({
      success: true,
      apostila: novaApostila,
      message: "Apostila enviada e validada com sucesso!",
    });
  } catch (error: any) {
    console.error("[api/apostilas/upload] Falha no upload:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno ao processar upload." },
      { status: 500 }
    );
  }
}
