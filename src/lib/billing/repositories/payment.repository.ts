/**
 * ConcursoAI — PaymentRepository (Billing)
 *
 * Camada de persistência do aggregate Payment (imutável).
 * Idempotência do webhook via provider_id único (índice parcial em billing.ts).
 */
import { desc, eq } from "drizzle-orm";
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

  /**
   * Reivindica o evento do provedor antes de qualquer efeito de negocio.
   *
   * O webhook do Mercado Pago chega duplicado e em paralelo. Checar
   * findByProviderId e gravar depois deixa uma janela em que duas entregas
   * ativam ou renovam a assinatura na mesma cobranca. Aqui o proprio insert e a
   * trava: uq_payments_provider_id faz o perdedor voltar null e o servico trata
   * isso como duplicidade, sem tocar em assinatura.
   */
  async claim(input: typeof payments.$inferInsert) {
    const rows = await db
      .insert(payments)
      .values(input)
      .onConflictDoNothing({ target: payments.providerId })
      .returning();
    return rows[0] ?? null;
  },

  /** Liga o evento ja reivindicado assinatura que ele originou. */
  async attachSubscription(id: string, subscriptionId: string) {
    const [row] = await db
      .update(payments)
      .set({ subscriptionId })
      .where(eq(payments.id, id))
      .returning();
    return row ?? null;
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
