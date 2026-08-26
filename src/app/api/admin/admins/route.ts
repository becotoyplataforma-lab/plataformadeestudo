/**
 * Admin — Gestão de Administradores (superadmin)
 *
 * GET  /api/admin/admins            — lista admins e superadmins (superadmin)
 * POST /api/admin/admins            — adiciona admin ou superadmin (superadmin)
 * DELETE /api/admin/admins          — remove admin ou superadmin (superadmin)
 *
 * Body (POST/DELETE): { email: string, role: "admin" | "superadmin" }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import {
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import {
  AdminManagementService,
  AdminManagementError,
} from "@/lib/administration/services/admin-management.service";

const EmailRoleSchema = z.object({
  email: z.string().email("E-mail inválido."),
  role: z.enum(["admin", "superadmin"]).default("admin"),
});

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const data = await AdminManagementService.list(admin);
    return NextResponse.json(data);
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json();
    const parsed = EmailRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;
    const result =
      role === "superadmin"
        ? await AdminManagementService.addSuperadmin(admin, email)
        : await AdminManagementService.addAdmin(admin, email);

    return NextResponse.json({ ok: true, role, list: result });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json();
    const parsed = EmailRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;
    if (role === "superadmin") {
      await AdminManagementService.assertNotSelf(admin, email);
    }

    const result =
      role === "superadmin"
        ? await AdminManagementService.removeSuperadmin(admin, email)
        : await AdminManagementService.removeAdmin(admin, email);

    return NextResponse.json({ ok: true, role, list: result });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

function adminErrorResponse(error: unknown): NextResponse {
  if (error instanceof AdminError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
  }
  if (error instanceof AdminManagementError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
  }
  console.error("[admin/admins] Erro:", error);
  return NextResponse.json(
    { error: "Erro interno", message: "Falha ao gerenciar administradores." },
    { status: 500 }
  );
}
