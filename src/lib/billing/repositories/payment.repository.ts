/**
 * ConcursoAI — PaymentRepository (Billing)
 *
 * Camada de persistência do aggregate Payment (imutável).
 * Idempotência do webhook via provider_id único (índice parcial em billing.ts).
 */
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { payments } from "@/db/schema/billing";

export const PaymentRepository = {
  /** Buscar pagamento por ID no provedor (idempotência). */
  async findByProviderId(providerId: string) {
    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.providerId, providerId))
      .limit(1);
    return row ?? null;
  },

  /** Criar pagamento (registro imutável). */
  async create(input: typeof payments.$inferInsert) {
    const [row] = await db.insert(payments).values(input).returning();
    return row;
  },

  /** Listar pagamentos do usuário (mais recentes primeiro). */
  async findByUser(userId: string, limit = 20) {
    return db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(limit);
  },
};
