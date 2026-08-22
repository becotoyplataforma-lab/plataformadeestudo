/**
 * Admin — System Setting por chave
 *
 * GET    /api/admin/settings/[key] — lê configuração (admin)
 * PATCH  /api/admin/settings/[key] — atualiza (admin)
 * DELETE /api/admin/settings/[key] — remove (admin)
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/administration/session";
import { strictDto } from "@/lib/dto";
import {
  AdminGuardService,
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import {
  SystemSettingService,
  SettingError,
} from "@/lib/administration/services/system-setting.service";
import {
  SystemSettingDtoSchema,
  SetSettingRequestDtoSchema,
  mapSystemSettingToDto,
} from "@/lib/dto/administration.dto";

type Ctx = { params: Promise<{ key: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const { key } = await ctx.params;
    const row = await SystemSettingService.get(key, undefined);
    if (row === undefined) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Configuração não encontrada." }, { status: 404 });
    }
    // O valor bruto é exposto; o contrato usa o schema de configuração.
    return NextResponse.json({ key, value: row });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { key } = await ctx.params;
    const body = await request.json();
    const parsed = SetSettingRequestDtoSchema.safeParse({ key, ...body });
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

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { key } = await ctx.params;
    const row = await SystemSettingService.remove(admin, key);
    if (!row) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Configuração não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ removed: true, key });
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
  console.error("[admin/settings/[key]] Erro:", error);
  return NextResponse.json(
    { error: "Erro interno", message: "Falha ao processar configuração." },
    { status: 500 }
  );
}
