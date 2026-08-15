/**
 * POST /api/admin/avatares — cria avatar (personagem original) — admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import { AvatarRepository } from "@/lib/ai/repositories/avatar.repository";

const AvatarSchema = z.object({
  nome: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  descricao: z.string().max(1000).optional(),
  personalidade: z.string().max(1000).optional(),
  aparencia: z.string().max(1000).optional(),
  voz: z.string().max(200).optional(),
});

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const avatars = await AvatarRepository.listActive();
    return NextResponse.json(
      avatars.map((a) => ({ id: a.id, nome: a.nome, slug: a.slug }))
    );
  } catch (error) {
    console.error("[admin/avatares GET] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const parsed = AvatarSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const row = await AvatarRepository.create({
      nome: parsed.data.nome,
      slug: parsed.data.slug,
      descricao: parsed.data.descricao ?? null,
      personalidade: parsed.data.personalidade ?? null,
      aparencia: parsed.data.aparencia ?? null,
      voz: parsed.data.voz ?? null,
      ativo: true,
    });

    return NextResponse.json({ id: row.id, nome: row.nome, slug: row.slug }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/avatares] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao criar avatar." },
      { status: 500 }
    );
  }
}
