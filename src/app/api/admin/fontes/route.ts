/**
 * GET /api/admin/fontes — biblioteca de fontes externas (admin).
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/administration/session";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const docs = await DocumentRepository.listExternalSources(200);
    return NextResponse.json(
      docs.map((d) => {
        const metadata = (d.metadata ?? {}) as Record<string, unknown>;
        return {
          id: d.id,
          title: d.title,
          type: d.type,
          status: d.status,
          reviewStatus: d.reviewStatus,
          sourceType: d.sourceType,
          sourceUrl: d.sourceUrl,
          fonte: metadata.fonte ?? null,
          licenca: metadata.licenca ?? null,
          createdAt: d.createdAt.toISOString(),
        };
      })
    );
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/fontes] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
