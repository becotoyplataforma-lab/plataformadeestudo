/**
 * ConcursoAI — PlanRepository (Billing)
 *
 * Camada de persistência do aggregate Plan.
 * Catálogo de planos e seus limites (JSON) — fonte dos limites (OPEN-004).
 */
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { plans } from "@/db/schema/billing";

export const PlanRepository = {
  /** Buscar plano ativo por código (ex.: free, pro, intensivo). */
  async findByCode(code: string) {
    const [row] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.code, code), isNull(plans.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Buscar plano por ID (não deletado). */
  async findById(id: string) {
    const [row] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, id), isNull(plans.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Listar planos ativos (catálogo), do menor para o maior preço. */
  async listActive() {
    return db
      .select()
      .from(plans)
      .where(and(eq(plans.status, "active"), isNull(plans.deletedAt)))
      .orderBy(plans.priceCents);
  },

  /** Criar plano (admin/ops). */
  async create(input: typeof plans.$inferInsert) {
    const [row] = await db.insert(plans).values(input).returning();
    return row;
  },
};
