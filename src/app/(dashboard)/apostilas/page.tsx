import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import { auth } from "@/lib/auth/auth";
import { ApostilasService } from "@/lib/knowledge/services/apostilas.service";
import { ApostilasClient } from "@/components/apostilas/apostilas-client";
import { DEMO_APOSTILAS_LISTA } from "@/lib/constants/demo-apostilas";
import type { ApostilasListaDto } from "@/lib/dto/apostilas.dto";
import { gerarAula02Preview } from "@/lib/apostilas/gerador-aula-02";
import { gerarAula03Preview } from "@/lib/apostilas/gerador-aula-03";
import { gerarAula04Preview } from "@/lib/apostilas/gerador-aula-04";
import { gerarAula05Preview } from "@/lib/apostilas/gerador-aula-05";
import { executarGeracaoAulas06a13 } from "@/lib/apostilas/executar-geracao-completa";
import { escanearDiretorios } from "@/lib/apostilas/scanner";
import { converterTodasAulas } from "@/lib/apostilas/pdf-conversor";

export const metadata: Metadata = {
  title: "Apostilas",
  description: "Suas apostilas e PDFs de estudo, agrupados por matéria.",
};

export default async function ApostilasPage() {
  // Escaneia diretórios do drive em segundo plano
  try {
    escanearDiretorios();
  } catch (err) {
    console.error("[apostilas] Erro no scan:", err);
  }

  // Garante que todos os previews HTML existam no disco
  try {
    const p2 = path.join(process.cwd(), "public", "preview", "aula-02-preview.html");
    if (!fs.existsSync(p2)) gerarAula02Preview();
    const p3 = path.join(process.cwd(), "public", "preview", "aula-03-preview.html");
    if (!fs.existsSync(p3)) gerarAula03Preview();
    const p4 = path.join(process.cwd(), "public", "preview", "aula-04-preview.html");
    if (!fs.existsSync(p4)) gerarAula04Preview();
    const p5 = path.join(process.cwd(), "public", "preview", "aula-05-preview.html");
    if (!fs.existsSync(p5)) gerarAula05Preview();

    // Gera o lote das Aulas 06 a 13 se faltar qualquer uma delas
    const p13 = path.join(process.cwd(), "public", "preview", "aula-13-preview.html");
    if (!fs.existsSync(p13)) {
      executarGeracaoAulas06a13();
    }

    // Garante que os PDFs das apostilas adaptadas estejam prontos para download
    const relatorioPath = path.join(process.cwd(), "public", "relatorio-conversao-pdf.json");
    if (!fs.existsSync(relatorioPath)) {
      converterTodasAulas();
    }
  } catch (err) {
    console.error("[apostilas] Erro ao verificar preview:", err);
  }

  const session = await auth();
  const userId = session?.user?.id;

  let inicial: ApostilasListaDto | null = null;
  if (userId) {
    try {
      const res = await ApostilasService.listar({ userId });
      if (res && res.total_apostilas > 0) {
        inicial = res;
      } else {
        inicial = DEMO_APOSTILAS_LISTA;
      }
    } catch (error) {
      console.error("[apostilas] SSR fallback para demo apostilas:", error);
      inicial = DEMO_APOSTILAS_LISTA;
    }
  } else {
    inicial = DEMO_APOSTILAS_LISTA;
  }

  return <ApostilasClient initialLista={inicial} />;
}
