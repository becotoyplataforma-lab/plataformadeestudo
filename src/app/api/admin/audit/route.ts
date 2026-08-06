/**
 * Admin — Auditoria
 *
 * GET /api/admin/audit?entity_type=&limit= — lista ações administrativas (admin)
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/administration/session";
import { strictDto } from "@/lib/dto";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import { AuditService } from "@/lib/administration/services/audit.service";
import {
  AdminActionLogListDtoSchema,
  mapAdminActionLogToDto,
} from "@/lib/dto/administration.dto";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const entityType = request.nextUrl.searchParams.get("entity_type") ?? undefined;
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? clampLimit(Number(limitRaw)) : 50;

    const rows = await AuditService.list(admin, { entityType, limit });
    const dto = strictDto(
      AdminActionLogListDtoSchema,
      { data: rows.map(mapAdminActionLogToDto) }
    );
    return NextResponse.json(dto);
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/audit] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao listar auditoria." },
      { status: 500 }
    );
  }
}

function clampLimit(limit: number): number {
  if (Number.isNaN(limit)) return 50;
  return Math.min(200, Math.max(1, Math.floor(limit)));
}
