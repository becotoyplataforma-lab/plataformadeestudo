/**
 * ConcursoAI — Domínio BILLING — Drizzle ORM Schema
 *
 * PostgreSQL · Drizzle ORM · TypeScript Strict
 *
 * Base oficial:
 * - docs/08-DATABASE-PHYSICAL.md (plans, subscriptions, payments)
 * - docs/05-DOMAIN-MODEL.md (aggregate roots: Plan, Subscription+Payment)
 * - docs/07-ENTITY-STANDARDS.md (UUID, soft delete, auditoria, RLS, naming)
 * - ADR-001 (auth.users como fonte de identidade)
 *
 * OPEN-004: Billing é dono dos limites (plan.limits). AI continua responsável
 * por registrar ai_usage. Este schema não cria tabelas de AI.
 *
 * Apenas schema, enums e relações. Sem lógica de negócio.
 */
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers, lifecycleStatus } from "./identity";

// ============================================================
// ENUMS
// ============================================================

/** Estado da assinatura (subscription_status). */
export const subscriptionStatus = pgEnum("subscription_status", [
  "active",
  "cancelled",
  "expired",
  "past_due",
  "suspended",
]);

/** Estado do pagamento (payment_status). */
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "refunded",
]);

// ============================================================
// PLANS — nível de acesso e limites (agregado raiz do Billing)
// ============================================================

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    promoPriceCents: integer("promo_price_cents"),
    limits: jsonb("limits").notNull().default({}),
    status: lifecycleStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_plans_code").on(t.code),
    check("chk_plans_price", sql`${t.priceCents} >= 0`),
    index("idx_plans_status").on(t.status),
  ]
);

// ============================================================
// SUBSCRIPTIONS — vínculo do usuário a um plano (agregado raiz + Payment)
// ============================================================

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    status: subscriptionStatus("status").notNull().default("active"),
    startsAt: timestamp("starts_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // Uma assinatura ativa por usuário (parcial).
    uniqueIndex("uq_subscriptions_user_active")
      .on(t.userId)
      .where(sql`${t.deletedAt} is null AND ${t.status} = 'active'`),
    index("idx_subscriptions_user_status").on(t.userId, t.status),
    check(
      "chk_subscriptions_dates",
      sql`${t.endsAt} is null OR ${t.endsAt} > ${t.startsAt}`
    ),
  ]
);

// ============================================================
// PAYMENTS — transação registrada (imutável, pertence ao agregado Subscription)
// ============================================================

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(
      () => subscriptions.id,
      { onDelete: "set null" }
    ),
    provider: text("provider").notNull(),
    providerId: text("provider_id"),
    amountCents: integer("amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("BRL"),
    status: paymentStatus("status").notNull().default("pending"),
    externalReference: text("external_reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Idempotência: o mesmo pagamento no provedor é único.
    uniqueIndex("uq_payments_provider_id")
      .on(t.providerId)
      .where(sql`${t.providerId} is not null`),
    index("idx_payments_user_created").on(t.userId, t.createdAt),
    index("idx_payments_subscription").on(t.subscriptionId),
    check("chk_payments_amount", sql`${t.amountCents} >= 0`),
  ]
);

// ============================================================
// RELAÇÕES
// ============================================================

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(
  subscriptions,
  ({ one, many }) => ({
    user: one(authUsers, {
      fields: [subscriptions.userId],
      references: [authUsers.id],
    }),
    plan: one(plans, {
      fields: [subscriptions.planId],
      references: [plans.id],
    }),
    payments: many(payments),
  })
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(authUsers, {
    fields: [payments.userId],
    references: [authUsers.id],
  }),
  subscription: one(subscriptions, {
    fields: [payments.subscriptionId],
    references: [subscriptions.id],
  }),
}));

