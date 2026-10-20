import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET() {
  try {
    const dir = path.join("H:", "Meu Drive", "plataforma de estudo", "cbm-rj", "portugues", "apostila");
    let files: string[] = [];
    if (fs.existsSync(dir)) {
      files = fs.readdirSync(dir);
    }

    // Também verifica na pasta de questoes
    const dirQuestoes = path.join("H:", "Meu Drive", "plataforma de estudo", "cbm-rj", "portugues", "questoes");
    let questoesFiles: string[] = [];
    if (fs.existsSync(dirQuestoes)) {
      questoesFiles = fs.readdirSync(dirQuestoes);
    }

    // Salva o resultado em arquivo local no workspace para o agente ler
    const reportPath = path.join(process.cwd(), "public", "scan-apostilas.json");
    fs.writeFileSync(reportPath, JSON.stringify({ dir, files, dirQuestoes, questoesFiles }, null, 2), "utf-8");

    return NextResponse.json({ ok: true, dir, files, questoesFiles });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
  }
}
