import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { DEMO_APOSTILAS_LISTA } from "@/lib/constants/demo-apostilas";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? "00000000-0000-4000-8000-000000000001";

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const titulo = (formData.get("titulo") as string) || "Nova Apostila";
    const concurso = (formData.get("concurso") as string) || "CBM-RJ";
    const materiaNome = (formData.get("materia") as string) || "Língua Portuguesa";

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const fileName = `${id}-${safeName}`;

    // 1. Salva em public/apostilas para acesso imediato no navegador
    const publicApostilasDir = path.join(process.cwd(), "public", "apostilas");
    fs.mkdirSync(publicApostilasDir, { recursive: true });
    const publicFilePath = path.join(publicApostilasDir, fileName);
    fs.writeFileSync(publicFilePath, buffer);

    // 2. Salva em .storage/apostilas para persistência estruturada
    const storageDir = path.join(process.cwd(), ".storage", "apostilas", userId, id);
    fs.mkdirSync(storageDir, { recursive: true });
    fs.writeFileSync(path.join(storageDir, fileName), buffer);

    // 3. Registra a nova apostila na lista
    const novaApostila = {
      id,
      titulo,
      tipo: "pdf",
      status: "indexed" as const,
      tamanho_bytes: buffer.byteLength,
      mime_type: file.type || "application/pdf",
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
      message: "Apostila enviada com sucesso! Disponível imediatamente no leitor.",
    });
  } catch (error: any) {
    console.error("[api/apostilas/upload] Falha no upload:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno ao processar upload." },
      { status: 500 }
    );
  }
}
