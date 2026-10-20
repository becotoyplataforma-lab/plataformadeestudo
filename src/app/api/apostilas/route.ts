/**
 * GET /api/apostilas — "Minhas Apostilas" (Fase 1)
 *
 * Lista as apostilas/PDFs do usuário agrupados por matéria,
 * com filtros opcionais: ?materia_id=<uuid>&concurso=<nome>&busca=<texto>
 * Suporta acesso para convidados e fallback para DEMO_APOSTILAS_LISTA quando offline.
 */
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { ZodError } from "zod";
import { auth } from "@/lib/auth/auth";
import { apiError, apiOk } from "@/lib/api/helpers";
import { ApostilasService } from "@/lib/knowledge/services/apostilas.service";
import { parseApostilasFilter } from "@/lib/validations/apostilas";
import { DEMO_APOSTILAS_LISTA } from "@/lib/constants/demo-apostilas";
import { executarGeracaoAulas06a13 } from "@/lib/apostilas/executar-geracao-completa";
import { escanearDiretorios } from "@/lib/apostilas/scanner";
import "@/lib/apostilas/pdf-conversor";

export async function GET(request: NextRequest) {
  try {
    escanearDiretorios();
  } catch (err) {
    console.warn("[api/apostilas] Erro no scan:", err);
  }
  // Garante que todo o acervo HTML até a aula 13 esteja pronto em disco
  try {
    const p13 = path.join(process.cwd(), "public", "preview", "aula-13-preview.html");
    if (!fs.existsSync(p13)) {
      executarGeracaoAulas06a13();
    }
  } catch (err) {
    console.warn("[api/apostilas] Execução do gerador de lote:", err);
  }

  const session = await auth();
  const userId = session?.user?.id ?? "00000000-0000-4000-8000-000000000001";

  try {
    const filtro = parseApostilasFilter(request.nextUrl.searchParams);

    try {
      const lista = await ApostilasService.listar({
        userId,
        materiaId: filtro.materia_id,
        concurso: filtro.concurso,
        busca: filtro.busca,
      });

      if (lista && lista.total_apostilas > 0) {
        return apiOk(lista);
      }
    } catch {
      // Banco indisponível ou vazio, usa o fallback abaixo
    }

    // Fallback gracioso com filtragem local
    let filtradasMaterias = DEMO_APOSTILAS_LISTA.materias;

    if (filtro.materia_id) {
      filtradasMaterias = filtradasMaterias.filter((m) => m.materia_id === filtro.materia_id);
    }

    if (filtro.concurso) {
      const concursoLower = filtro.concurso.toLowerCase();
      filtradasMaterias = filtradasMaterias
        .map((m) => ({
          ...m,
          apostilas: m.apostilas.filter(
            (a) => a.concurso?.toLowerCase() === concursoLower
          ),
        }))
        .filter((m) => m.apostilas.length > 0);
    }

    if (filtro.busca) {
      const buscaLower = filtro.busca.toLowerCase();
      filtradasMaterias = filtradasMaterias
        .map((m) => ({
          ...m,
          apostilas: m.apostilas.filter(
            (a) =>
              a.titulo.toLowerCase().includes(buscaLower) ||
              a.materia_nome?.toLowerCase().includes(buscaLower) ||
              a.concurso?.toLowerCase().includes(buscaLower)
          ),
        }))
        .filter((m) => m.apostilas.length > 0);
    }

    const totalApostilas = filtradasMaterias.reduce((acc, m) => acc + m.apostilas.length, 0);

    return apiOk({
      usuario_id: userId,
      total_apostilas: totalApostilas,
      total_materias: filtradasMaterias.length,
      concursos: DEMO_APOSTILAS_LISTA.concursos,
      materias: filtradasMaterias,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(400, error.issues[0]?.message ?? "Parâmetros inválidos.");
    }
    console.error("[api/apostilas] falha ao listar:", error);
    return apiOk(DEMO_APOSTILAS_LISTA);
  }
}
