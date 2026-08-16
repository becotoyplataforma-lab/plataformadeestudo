/**
 * ConcursoAI — SubscriptionRepository (Billing)
 *
 * Camada de persistência do aggregate Subscription (raiz que inclui Payment).
 * Uma assinatura ativa por usuário (índice parcial em billing.ts).
 */
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { subscriptions } from "@/db/schema/billing";

export const SubscriptionRepository = {
  /** Buscar assinatura ativa do usuário (status = active, não deletada). */
  async findActiveByUser(userId: string) {
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, "active"),
          isNull(subscriptions.deletedAt)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /** true se o usuário já teve QUALQUER assinatura (ativa ou não).
   *  Usado pelo checkout para decidir preço promocional (1º ciclo). */
  async hasAnyByUser(userId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    return Boolean(row);
  },

  /** Buscar assinatura por ID (valida ownership quando userId informado). */
  async findById(id: string, userId?: string) {
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.id, id),
          ...(userId ? [eq(subscriptions.userId, userId)] : []),
          isNull(subscriptions.deletedAt)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /** Criar assinatura. */
  async create(input: typeof subscriptions.$inferInsert) {
    const [row] = await db.insert(subscriptions).values(input).returning();
    return row;
  },

  /** Atualizar assinatura. */
  async update(id: string, input: Partial<typeof subscriptions.$inferInsert>) {
    const [row] = await db
      .update(subscriptions)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return row ?? null;
  },

  /** Cancelar (soft) todas as assinaturas ativas do usuário. */
  async cancelActiveByUser(userId: string) {
    return db
      .update(subscriptions)
      .set({ status: "cancelled", endsAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, "active"),
          isNull(subscriptions.deletedAt)
        )
      )
      .returning();
  },
};
