/**
 * ConcursoAI — OrganBoardRepository (Administration)
 *
 * Catálogos de órgãos (organs) e bancas (boards) — obrigatórios para criar
 * um concurso (FKs NOT NULL). Find-or-create por slug, idempotente.
 * Soft delete: marca deleted_at.
 */
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { organs, boards } from "@/db/schema/contest";
import { slugify } from "@/lib/utils/slug";

export const OrganBoardRepository = {
  // ============================ ORGANS ============================
  /** Lista órgãos ativos. */
  async listOrgans() {
    return db
      .select()
      .from(organs)
      .where(isNull(organs.deletedAt))
      .orderBy(asc(organs.name));
  },

  /** Busca órgão por id. */
  async findOrganById(id: string) {
    const [row] = await db
      .select()
      .from(organs)
      .where(and(eq(organs.id, id), isNull(organs.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Busca órgão por slug (detecta duplicidade). */
  async findOrganBySlug(slug: string) {
    const [row] = await db
      .select()
      .from(organs)
      .where(and(eq(organs.slug, slug), isNull(organs.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Cria órgão (slug gerado automaticamente se não informado). */
  async createOrgan(input: {
    name: string;
    slug?: string;
    description?: string | null;
    status?: "active" | "inactive";
  }) {
    const slug = input.slug ?? slugify(input.name);
    const [row] = await db
      .insert(organs)
      .values({
        name: input.name,
        slug,
        description: input.description ?? null,
        status: input.status ?? "active",
      })
      .returning();
    return row;
  },

  /** Find-or-create de órgão por nome (idempotente). */
  async findOrCreateOrgan(name: string) {
    const slug = slugify(name);
    const existing = await this.findOrganBySlug(slug);
    if (existing) return existing;
    return this.createOrgan({ name, slug });
  },

  // ============================ BOARDS ============================
  /** Lista bancas ativas. */
  async listBoards() {
    return db
      .select()
      .from(boards)
      .where(isNull(boards.deletedAt))
      .orderBy(asc(boards.name));
  },

  /** Busca banca por id. */
  async findBoardById(id: string) {
    const [row] = await db
      .select()
      .from(boards)
      .where(and(eq(boards.id, id), isNull(boards.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Busca banca por slug (detecta duplicidade). */
  async findBoardBySlug(slug: string) {
    const [row] = await db
      .select()
      .from(boards)
      .where(and(eq(boards.slug, slug), isNull(boards.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Cria banca (slug gerado automaticamente se não informado). */
  async createBoard(input: {
    name: string;
    slug?: string;
    description?: string | null;
    status?: "active" | "inactive";
  }) {
    const slug = input.slug ?? slugify(input.name);
    const [row] = await db
      .insert(boards)
      .values({
        name: input.name,
        slug,
        description: input.description ?? null,
        status: input.status ?? "active",
      })
      .returning();
    return row;
  },

  /** Find-or-create de banca por nome (idempotente). */
  async findOrCreateBoard(name: string) {
    const slug = slugify(name);
    const existing = await this.findBoardBySlug(slug);
    if (existing) return existing;
    return this.createBoard({ name, slug });
  },
};
