/**
 * Contrato de idempotancia do ledger de pagamentos (FASE B5).
 *
 * A unica trava real contra entrega duplicada do webhook e o indice UNICO
 * parcial uq_payments_provider_id. O servico chama claim() e confia no banco:
 * se o insert nao devolve linha, aquela entrega perdeu a corrida. As assercoes
 * abaixo fixam as duas metades da promessa — o comportamento do repositorio
 * (drizzle mockado, sem conexao) e a presenca do indice no DDL aplicado — para
 * que remover a trava quebre o teste em vez de duplicar assinatura em producao.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  values: vi.fn(),
  onConflictDoNothing: vi.fn(),
  returning: vi.fn(),
}));

vi.mock("@/lib/db/drizzle", () => ({
  db: { insert: mocks.insert },
}));

import { PaymentRepository } from "@/lib/billing/repositories/payment.repository";
import { payments } from "@/db/schema/billing";

/** Repoe a cadeia insert().values().onConflictDoNothing().returning(). */
function chain(returned: unknown[]) {
  mocks.values.mockImplementation(() => ({
    onConflictDoNothing: mocks.onConflictDoNothing.mockImplementation(() => ({
      returning: mocks.returning.mockResolvedValue(returned),
    })),
  }));
  mocks.insert.mockImplementation(() => ({ values: mocks.values }));
}

const CLAIM_INPUT = {
  userId: "u1",
  provider: "mercadopago",
  providerId: "123",
  amountCents: 1990,
  status: "approved",
} as const;

describe("PaymentRepository.claim() — trava de corrida no ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reivindica com insert que ignora conflito em provider_id", async () => {
    chain([{ id: "pay-new" }]);

    const row = await PaymentRepository.claim(CLAIM_INPUT);

    expect(mocks.onConflictDoNothing).toHaveBeenCalledWith({ target: payments.providerId });
    expect(row).toEqual({ id: "pay-new" });
  });

  it("entrega que perde a corrida devolve null (sinal de duplicidade)", async () => {
    chain([]);

    await expect(PaymentRepository.claim(CLAIM_INPUT)).resolves.toBeNull();
  });

  it("a perda devolve null explicito, nunca undefined", async () => {
    // O servico trata qualquer falsy como duplicate=true. Se claim() passasse a
    // devolver undefined (ou nada), perda real de corrida e mock nao semeado
    // ficariam indistingiveis no log do webhook. null e o contrato da trava.
    chain([]);

    const lost = await PaymentRepository.claim(CLAIM_INPUT);

    expect(lost).toBeNull();
    expect(lost).not.toBeUndefined();
  });
});

describe("uq_payments_provider_id — existe no DDL que foi aplicado", () => {
  const DRIZZLE_DIR = join(process.cwd(), "drizzle");
  const journal = JSON.parse(
    readFileSync(join(DRIZZLE_DIR, "meta", "_journal.json"), "utf-8")
  ) as { entries: Array<{ idx: number; tag: string }> };

  function read(...parts: string[]): string {
    return readFileSync(join(process.cwd(), ...parts), "utf-8");
  }

  it("o schema Drizzle declara indice UNICO parcial sobre provider_id", () => {
    const billingSchema = read("src", "db", "schema", "billing.ts");
    expect(billingSchema).toContain('uniqueIndex("uq_payments_provider_id")');
    expect(billingSchema).toMatch(/\.on\(t\.providerId\)/);
    expect(billingSchema).toMatch(/providerId\} is not null/);
  });

  it("a migration aplicada cria a trava com o mesmo predicado", () => {
    const migration = read("drizzle", "0001_romantic_siren.sql");
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "uq_payments_provider_id" ON "payments"[\s\S]*?"provider_id"\) WHERE [\s\S]*?is not null/i
    );
  });

  it("a migration do ledger nao e orfa: esta no journal", () => {
    expect(journal.entries.map((entry) => entry.tag)).toContain("0001_romantic_siren");
  });

  it("nenhuma migration derruba a trava", () => {
    const sqlFiles = readdirSync(DRIZZLE_DIR).filter((file) => file.endsWith(".sql"));
    expect(sqlFiles.length).toBeGreaterThan(0);
    for (const file of sqlFiles) {
      expect(readFileSync(join(DRIZZLE_DIR, file), "utf-8")).not.toMatch(
        /DROP INDEX[\s\S]{0,120}uq_payments_provider_id/i
      );
    }
  });

  it("o DDL de referencia do billing tambem mantem a trava", () => {
    const reference = read("database", "billing", "schema.sql");
    expect(reference).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_id/i);
  });

  it("o webhook so entra no ledger por claim(): create() nao e usado", () => {
    const webhook = read("src", "lib", "billing", "services", "webhook.service.ts");
    expect(webhook).toContain("PaymentRepository.claim(");
    expect(webhook).not.toContain("PaymentRepository.create(");
  });

  it("a suite do webhook mantem a trava de seed do claim()", () => {
    // Trava da regressao da FASE B: sem seed, claim() devolvia undefined e 6
    // testes caian por esqueleto de mock -- nada a ver com o contrato de
    // idempotencia. O arquivo do suite do webhook precisa manter (1) o wrapper
    // que recusa chamada sem implementacao e (2) o seed padrao no beforeEach.
    const suite = read(
      "src",
      "lib",
      "billing",
      "services",
      "__tests__",
      "webhook.service.test.ts"
    );

    expect(suite).toContain("claim: (...args: unknown[]) => claimWithSeedGuard(...args)");
    expect(suite).toContain("MOCK_CLAIM_NOT_SEEDED");
    expect(suite).toContain('mockClaimPayment.mockResolvedValue({ id: "pay-new" })');
  });
});
