/**
 * POST /api/admin/apostilas/batch — upload em lote de apostilas (admin).
 * Exige vínculo a uma matéria (obrigatório) e aceita edital/cargo opcionais.
 * Processa cada arquivo com a mesma pipeline do upload individual e retorna
 * resultado por arquivo (fila visível na UI), sem falhar o lote inteiro.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import { IngestionService, IngestionError } from "@/lib/knowledge/services/ingestion.service";
import { DocumentStorageService } from "@/lib/knowledge/storage.service";
import { DocumentPipelineService } from "@/lib/knowledge/services/document-pipeline.service";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentSubjectRepository } from "@/lib/knowledge/repositories/junction.repository";

const MAX_FILES = 20;

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const formData = await request.formData();
    const subjectId = (formData.get("subject_id") as string) || "";
    const editalId = (formData.get("edital_id") as string) || null;
    const positionId = (formData.get("position_id") as string) || null;

    const fileEntries = Array.from(formData.entries()).filter(
      ([key]) => key === "files"
    );
    const files = fileEntries
      .map(([, v]) => v)
      .filter((v): v is File => v instanceof File && v.size > 0);

    if (!subjectId) {
      return NextResponse.json(
        { error: "SUBJECT_REQUIRED", message: "Vincule os arquivos a uma matéria." },
        { status: 400 }
      );
    }
    const parsed = z.string().uuid().safeParse(subjectId);
    if (!parsed.success) {
      return NextResponse.json({ error: "SUBJECT_INVALID", message: "Matéria inválida." }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json(
        { error: "NO_FILES", message: "Nenhum arquivo enviado." },
        { status: 400 }
      );
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: "TOO_MANY_FILES", message: `Máximo de ${MAX_FILES} arquivos por lote.` },
        { status: 400 }
      );
    }

    const results: Array<{
      fileName: string;
      documentId?: string;
      status: string;
      error?: string;
      code?: string;
    }> = [];

    for (const file of files) {
      try {
        const result = await IngestionService.ingest({
          userId: admin.userId,
          file,
          sourceType: "upload",
        });

        const buffer = Buffer.from(await file.arrayBuffer());
        await DocumentStorageService.upload({
          userId: admin.userId,
          documentId: result.documentId,
          fileName: file.name,
          buffer,
          mimeType: result.mimeType,
        });

        await DocumentPipelineService.processDocument(result.documentId).catch(() => undefined);

        await DocumentSubjectRepository.upsert(result.documentId, subjectId, 100).catch(
          () => undefined
        );
        if (editalId || positionId) {
          await DocumentRepository.updateAssociations(result.documentId, {
            editalId: editalId ?? null,
            positionId: positionId ?? null,
          }).catch(() => undefined);
        }

        const doc = await DocumentRepository.findById(result.documentId);
        results.push({
          fileName: file.name,
          documentId: result.documentId,
          status: doc?.status ?? result.status,
        });
      } catch (error) {
        if (error instanceof IngestionError) {
          results.push({
            fileName: file.name,
            status: "failed",
            code: error.code,
            error: error.message,
          });
        } else {
          results.push({
            fileName: file.name,
            status: "failed",
            error: error instanceof Error ? error.message : "Falha desconhecida.",
          });
        }
      }
    }

    const okCount = results.filter((r) => r.status !== "failed").length;
    const failCount = results.length - okCount;

    return NextResponse.json(
      { results, okCount, failCount },
      { status: failCount > 0 ? 207 : 201 }
    );
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/apostilas/batch] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha no upload em lote." },
      { status: 500 }
    );
  }
}
