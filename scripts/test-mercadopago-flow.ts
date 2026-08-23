/**
 * ConcursoAI - Verificacao manual do ciclo de assinatura Mercado Pago
 * ====================================================================
 *
 * Harness de diagnostico que REUTILIZA os handlers reais ja implementados
 * (NAO reimplementa nada):
 *   - src/lib/payments/mercadopago.ts        -> createPreapproval / getPreapproval
 *   - src/lib/billing/services/webhook.service.ts -> WebhookService.handleNotification
 *   - src/lib/billing/services/subscription.service.ts -> SubscriptionService.renew/cancel
 *   - src/lib/billing/services/entitlement.service.ts -> EntitlementService.getCurrent
 *
 * IMPORTANTE: os modulos de billing importam `server-only`, que lanca erro fora
 * do contexto React Server. Para rodar via tsx, use a condicao `react-server`:
 *
 *   npx tsx --conditions=react-server scripts/test-mercadopago-flow.ts
 *
 * -----------------------------------------------------------------------------
 * COMO RODAR (3 comandos, em sequencia):
 * -----------------------------------------------------------------------------
 *
 * 1) CRIAR a Preapproval (assinatura recorrente do plano Pro) para um usuario
 *    de teste. Imprime o preapproval_id e o estado inicial em `subscriptions`.
 *
 *    npx tsx --conditions=react-server scripts/test-mercadopago-flow.ts
 *    # opcional: --user-id <uuid>  (padrao: primeiro usuario de auth.users)
 *    # opcional: --app-url <base>  (base URL p/ back_url/notification_url;
 *    #   se NEXT_PUBLIC_APP_URL nao estiver no .env, passe aqui)
 *
 *    [OK] PASSOU: preapproval criado (id=...), nenhuma assinatura ativa ainda
 *
 *    NOTA (sandbox): o access token de sandbox exige que o payer seja um
 *    USUARIO DE TESTE do Mercado Pago (criado via API de test users), nao um
 *    email real. Se o MP retornar "Both payer and collector must be real or
 *    test users", use um email de test user no auth.users correspondente.
 *
 * 2) SIMULAR a cobranca recorrente (payment.created aprovado). Deve RENOVAR a
 *    assinatura em +1 mes (ends_at estendido).
 *
 *    npx tsx --conditions=react-server scripts/test-mercadopago-flow.ts --simulate-payment
 *    # opcional: --payment-id <id>  (pagamento real do sandbox MP; se ausente,
 *    #   invoca SubscriptionService.renew - a MESMA funcao que o webhook chama)
 *
 *    [OK] PASSOU: assinatura renovada (ends_at = <antes> + 1 mes)
 *
 * 3) SIMULAR FALHA (pagamento rejeitado / cancelamento). Deve resultar em
 *    downgrade para o plano gratuito (entitlement = free).
 *
 *    npx tsx --conditions=react-server scripts/test-mercadopago-flow.ts --simulate-failure
 *    # opcional: --payment-id <id>  (pagamento rejeitado real do sandbox MP;
 *    #   se ausente, invoca SubscriptionService.cancel - o efeito de downgrade)
 *
 *    [OK] PASSOU: downgrade para free (entitlement.planCode = "free")
 *
 * -----------------------------------------------------------------------------
 * SAIDA ESPERADA (resumo no final de cada modo):
 *   [OK] PASSOU: assinatura criada com status X
 *   [OK] PASSOU: assinatura renovada (ends_at estendido em +1 mes)
 *   [OK] PASSOU: downgrade para free (entitlement.planCode = "free")
 *   [ERRO] FALHOU: <descricao do que era esperado vs. encontrado>
 * -----------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPreapproval } from "@/lib/payments/mercadopago";
import { WebhookService } from "@/lib/billing/services/webhook.service";
import { SubscriptionService } from "@/lib/billing/services/subscription.service";
import { EntitlementService } from "@/lib/billing/services/entitlement.service";
import { SubscriptionRepository } from "@/lib/billing/repositories/subscription.repository";
import { PlanRepository } from "@/lib/billing/repositories/plan.repository";
import { db } from "@/lib/db/drizzle";
import { authUsers } from "@/db/schema/identity";
import { eq } from "drizzle-orm";

// Carrega o .env (DATABASE_URL, MERCADO_PAGO_ACCESS_TOKEN, etc.) fora do
// contexto Next.js. Node >= 20.6 suporta process.loadEnvFile().
try {
  process.loadEnvFile();
} catch {
  // .env ausente: deixa o env.ts reportar o que falta.
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const STATE_FILE = join(process.cwd(), ".tmp-preapproval.json");

function parseArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = "true";
      }
    }
  }
  return out;
}

function saveState(data: Record<string, unknown>) {
  writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

function loadState(): Record<string, unknown> {
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

async function resolveUser(explicit?: string): Promise<{ id: string; email: string | null }> {
  if (explicit) {
    const [user] = await db
      .select({ id: authUsers.id, email: authUsers.email })
      .from(authUsers)
      .where(eq(authUsers.id, explicit))
      .limit(1);
    if (!user) {
      throw new Error(`Usuario nao encontrado: ${explicit}`);
    }
    return user;
  }
  const [user] = await db
    .select({ id: authUsers.id, email: authUsers.email })
    .from(authUsers)
    .limit(1);
  if (!user) {
    throw new Error(
      "Nenhum usuario encontrado em auth.users. Passe --user-id <uuid>."
    );
  }
  console.log(`[INFO] Usuario de teste: ${user.id} (${user.email ?? "sem email"})`);
  return user;
}

function fmtDate(d: Date | null | undefined): string {
  return d ? d.toISOString() : "-";
}

function fmtSub(sub: {
  id: string;
  status: string;
  planId: string;
  preapprovalId: string | null;
  startsAt: Date;
  endsAt: Date | null;
} | null): string {
  if (!sub) return "nenhuma assinatura";
  return [
    `id=${sub.id}`,
    `status=${sub.status}`,
    `planId=${sub.planId}`,
    `preapprovalId=${sub.preapprovalId ?? "null"}`,
    `startsAt=${fmtDate(sub.startsAt)}`,
    `endsAt=${fmtDate(sub.endsAt)}`,
  ].join("\n    ");
}

// -----------------------------------------------------------------------------
// Modo 1 - Criar Preapproval (assinatura recorrente do plano Pro)
// -----------------------------------------------------------------------------
async function modeCreatePreapproval(
  userId: string,
  payerEmail?: string | null,
  appUrl?: string
) {
  console.log("\n=== MODO 1: Criar Preapproval (plano Pro) ===");

  const plan = await PlanRepository.findByCode("pro");
  if (!plan) {
    console.log("[ERRO] FALHOU: plano 'pro' nao encontrado no catalogo.");
    process.exit(1);
  }
  console.log(`[INFO] Plano: ${plan.name} (${plan.code}) - R$ ${(plan.priceCents / 100).toFixed(2)}`);

  const externalReference = `pro:${userId}`;
  const preapproval = await createPreapproval({
    externalReference,
    reason: `Assinatura ConcursoAI - ${plan.name}`,
    unitPriceCents: plan.priceCents,
    payerEmail: payerEmail ?? undefined,
    notificationUrl: appUrl ? `${appUrl}/api/billing/webhook` : undefined,
    successUrl: appUrl ? `${appUrl}/configuracoes?pagamento=sucesso` : undefined,
    failureUrl: appUrl ? `${appUrl}/configuracoes?pagamento=falha` : undefined,
  });

  console.log("[OK] Preapproval criada no Mercado Pago:");
  console.log(`    id=${preapproval.id}`);
  console.log(`    status=${preapproval.status}`);
  console.log(`    external_reference=${preapproval.external_reference}`);

  // Estado atual em subscriptions. Nota: quando o usuario foi criado via
  // scripts/create-mp-test-user.ts, ja existe uma assinatura Pro ativa
  // (pre-ativada para o ciclo de teste). A Preapproval criada aqui e o
  // vinculo recorrente no MP; a assinatura local ja existe.
  const active = await SubscriptionRepository.findActiveByUser(userId);
  console.log("\nEstado atual em subscriptions:");
  console.log(`    ${fmtSub(active)}`);

  // Persiste o id para os proximos modos.
  saveState({ userId, preapprovalId: preapproval.id, planCode: "pro" });

  // O criterio de sucesso do MODO 1 e a criacao da Preapproval no MP com um
  // status valido (pending/authorized) e o external_reference correto.
  const validStatus = preapproval.status === "pending" || preapproval.status === "authorized";
  const validRef = preapproval.external_reference === externalReference;
  const ok = validStatus && validRef;
  console.log(
    ok
      ? "\n[OK] PASSOU: Preapproval criada com status " + preapproval.status +
        " e external_reference correto (" + externalReference + ")"
      : "\n[ERRO] FALHOU: Preapproval criada, mas status=" + preapproval.status +
        " ou external_reference=" + preapproval.external_reference +
        " (esperava " + externalReference + ")"
  );
  return ok;
}

// -----------------------------------------------------------------------------
// Modo 2 - Simular cobranca recorrente (payment.created aprovado) -> renovar +1 mes
// -----------------------------------------------------------------------------
async function modeSimulatePayment(userId: string, paymentId?: string) {
  console.log("\n=== MODO 2: Simular cobranca recorrente (renew +1 mes) ===");

  const before = await SubscriptionRepository.findActiveByUser(userId);
  console.log("Estado ANTES:");
  console.log(`    ${fmtSub(before)}`);

  if (!before) {
    console.log("[ERRO] FALHOU: nao ha assinatura ativa para renovar. Rode o MODO 1 primeiro.");
    process.exit(1);
  }

  const beforeEnd = before.endsAt && before.endsAt > new Date() ? before.endsAt : new Date();
  const expectedEnd = new Date(beforeEnd);
  expectedEnd.setMonth(expectedEnd.getMonth() + 1);

  if (paymentId) {
    // Caminho real: dispara o handler do webhook como se fosse payment.created.
    console.log(`[INFO] Disparando WebhookService.handleNotification (payment id=${paymentId})...`);
    const result = await WebhookService.handleNotification({
      type: "payment",
      data: { id: paymentId },
    });
    console.log(`    WebhookResult: ${JSON.stringify(result)}`);
  } else {
    // Simulacao sem pagamento real: invoca a MESMA funcao que o webhook chama
    // quando a cobranca recorrente e aprovada (SubscriptionService.renew).
    console.log(
      "[INFO] Sem --payment-id: invocando SubscriptionService.renew (a mesma funcao " +
        "que o webhook chama em cobranca recorrente aprovada)."
    );
    await SubscriptionService.renew(userId, "pro");
  }

  const after = await SubscriptionRepository.findActiveByUser(userId);
  console.log("\nEstado DEPOIS:");
  console.log(`    ${fmtSub(after)}`);

  const afterEnd = after?.endsAt;
  const renewed = after && after.status === "active" && afterEnd && afterEnd >= expectedEnd;
  console.log(
    renewed
      ? `\n[OK] PASSOU: assinatura renovada (ends_at = ${fmtDate(afterEnd)} - estendido em +1 mes)`
      : `\n[ERRO] FALHOU: esperava renovacao com ends_at >= ${fmtDate(expectedEnd)}, mas encontrou ends_at = ${fmtDate(afterEnd)}`
  );
  return Boolean(renewed);
}

// -----------------------------------------------------------------------------
// Modo 3 - Simular falha (pagamento rejeitado / cancelamento) -> downgrade p/ free
// -----------------------------------------------------------------------------
async function modeSimulateFailure(userId: string, paymentId?: string) {
  console.log("\n=== MODO 3: Simular falha (downgrade para free) ===");

  const before = await EntitlementService.getCurrent(userId);
  console.log(`Entitlement ANTES: planCode=${before.planCode} (tier=${before.tier})`);

  if (paymentId) {
    // Caminho real: dispara o handler do webhook com um pagamento rejeitado.
    console.log(`[INFO] Disparando WebhookService.handleNotification (payment id=${paymentId})...`);
    const result = await WebhookService.handleNotification({
      type: "payment",
      data: { id: paymentId },
    });
    console.log(`    WebhookResult: ${JSON.stringify(result)}`);
  } else {
    // Simulacao sem pagamento real: cancela a assinatura ativa (o efeito de
    // downgrade). O entitlement passa a resolver para o plano gratuito.
    console.log(
      "[INFO] Sem --payment-id: invocando SubscriptionService.cancel (o efeito de " +
        "downgrade quando a cobranca falha)."
    );
    await SubscriptionService.cancel(userId);
  }

  const after = await EntitlementService.getCurrent(userId);
  console.log(`\nEntitlement DEPOIS: planCode=${after.planCode} (tier=${after.tier})`);

  const sub = await SubscriptionRepository.findActiveByUser(userId);
  console.log(`Assinatura ativa apos falha: ${sub ? fmtSub(sub) : "nenhuma"}`);

  const downgraded = after.planCode === "free" && after.tier === "free";
  console.log(
    downgraded
      ? '\n[OK] PASSOU: downgrade para free (entitlement.planCode = "free")'
      : `\n[ERRO] FALHOU: esperava downgrade para free, mas encontrou plano ${after.planCode}`
  );
  return downgraded;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
async function main() {
  const args = parseArgs();
  const state = loadState();
  const user = await resolveUser(args["user-id"] ?? (state.userId as string | undefined));

  const appUrl = args["app-url"] ?? process.env.NEXT_PUBLIC_APP_URL;

  let ok: boolean;
  if (args["simulate-payment"]) {
    ok = await modeSimulatePayment(user.id, args["payment-id"]);
  } else if (args["simulate-failure"]) {
    ok = await modeSimulateFailure(user.id, args["payment-id"]);
  } else {
    ok = await modeCreatePreapproval(user.id, user.email, appUrl);
  }

  console.log(`\n${ok ? "[OK]" : "[ERRO]"} Resultado final: ${ok ? "PASSOU" : "FALHOU"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("\n[ERRO] Erro inesperado:", err);
  process.exit(1);
});
