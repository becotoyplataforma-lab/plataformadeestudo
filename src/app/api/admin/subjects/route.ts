/**
 * GET/POST /api/admin/subjects — catálogo de matérias (admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import {
  AdminGuardService,
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import { KnowledgeSubjectRepository } from "@/lib/knowledge/repositories/subject.repository";

const CreateSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  color: z.string().max(40).optional(),
  keywords: z.array(z.string().max(60)).max(20).optional(),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);
    const subjects = await KnowledgeSubjectRepository.getAll();
    return NextResponse.json(subjects);
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/subjects GET] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const body = await request.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const slug = slugify(parsed.data.name);
    const existing = await KnowledgeSubjectRepository.findBySlug(slug);
    if (existing) {
      return NextResponse.json(
        { error: "DUPLICATE_SUBJECT", message: "Já existe uma matéria com este nome." },
        { status: 409 }
      );
    }

    const row = await KnowledgeSubjectRepository.create({
      name: parsed.data.name,
      slug,
      description: parsed.data.description ?? null,
      color: parsed.data.color ?? null,
      keywords: parsed.data.keywords ?? [],
      status: "active",
    });

    return NextResponse.json({ id: row.id, name: row.name, slug: row.slug }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/subjects POST] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao criar matéria." },
      { status: 500 }
    );
  }
}
