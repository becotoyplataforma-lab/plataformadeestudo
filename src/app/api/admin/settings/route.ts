/**
 * Admin — System Settings
 *
 * GET  /api/admin/settings   — lista configurações (admin)
 * POST /api/admin/settings   — cria/atualiza configuração (admin)
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/administration/session";
import { strictDto } from "@/lib/dto";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import {
  SystemSettingService,
  SettingError,
} from "@/lib/administration/services/system-setting.service";
import {
  SetSettingRequestDtoSchema,
  SystemSettingListDtoSchema,
  SystemSettingDtoSchema,
  mapSystemSettingToDto,
} from "@/lib/dto/administration.dto";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const rows = await SystemSettingService.list(admin);
    const dto = strictDto(
      SystemSettingListDtoSchema,
      { data: rows.map(mapSystemSettingToDto) }
    );
    return NextResponse.json(dto);
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json();
    const parsed = SetSettingRequestDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const row = await SystemSettingService.set(
      admin,
      parsed.data.key,
      parsed.data.value,
      parsed.data.description
    );
    return NextResponse.json(strictDto(SystemSettingDtoSchema, mapSystemSettingToDto(row)));
  } catch (error) {
    return adminErrorResponse(error);
  }
}

function adminErrorResponse(error: unknown): NextResponse {
  if (error instanceof AdminError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
  }
  if (error instanceof SettingError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
  }
  console.error("[admin/settings] Erro:", error);
  return NextResponse.json(
    { error: "Erro interno", message: "Falha ao processar configurações." },
    { status: 500 }
  );
}
