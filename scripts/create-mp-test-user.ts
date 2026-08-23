/**
 * ConcursoAI - Criacao automatizada de usuario de teste do Mercado Pago
 * =====================================================================
 *
 * Cria um usuario de teste do Mercado Pago via API oficial (sem acao manual
 * no painel), insere o usuario correspondente no banco local (auth.users +
 * profiles + assinatura Pro) e salva o resultado em .mp-test-user.json para
 * que os demais scripts reutilizem automaticamente.
 *
 * Endpoint: POST https://api.mercadopago.com/users/test_user
 *   Headers: Authorization: Bearer {MERCADO_PAGO_ACCESS_TOKEN}
 *   Body: { "site_id": "MLB" }   (Brasil)
 *
 * COMO RODAR:
 *   npx tsx --conditions=react-server scripts/create-mp-test-user.ts
 *
 * SAIDA:
 *   Usuario de teste MP criado: <email> (userId: <id>) - salvo em .mp-test-user.json
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { PlanRepository } from "@/lib/billing/repositories/plan.repository";
import { SubscriptionRepository } from "@/lib/billing/repositories/subscription.repository";

// Carrega o .env fora do contexto Next.js.
try {
  process.loadEnvFile();
} catch {
  // .env ausente: deixa o env.ts reportar o que falta.
}

const STATE_FILE = join(process.cwd(), ".mp-test-user.json");

function getAccessToken(): string {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN nao configurado no .env");
  }
  return token;
}

/** Cria um usuario de teste no Mercado Pago via API oficial. */
async function createMpTestUser(): Promise<{ id: string; email: string }> {
  const res = await fetch("https://api.mercadopago.com/users/test_user", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ site_id: "MLB" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mercado Pago erro ${res.status} ao criar test_user: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as { id: string; email: string };
  return data;
}

/** Insere (ou atualiza) o usuario de teste em auth.users + profiles. */
async function upsertLocalUser(email: string): Promise<string> {
  const id = randomUUID();

  // auth.users: mesmo padrao dos usuarios de diagnostico existentes.
  // O unico indice unico em email e o parcial `users_email_partial_key`
  // (UNIQUE (email) WHERE is_sso_user = false). Para partial index, o
  // ON CONFLICT precisa repetir a mesma expressao do indice.
  await db.execute(sql`
    INSERT INTO auth.users (id, email, role, aud, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
    VALUES (${id}, ${email}, 'authenticated', 'authenticated', now(), ${JSON.stringify({ email_verified: true })}, now(), now())
    ON CONFLICT (email) WHERE (is_sso_user = false) DO UPDATE SET
      role = 'authenticated',
      aud = 'authenticated',
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
      raw_user_meta_data = ${JSON.stringify({ email_verified: true })},
      updated_at = now()
    RETURNING id
  `);

  // profiles: o trigger on_auth_user_created NAO existe neste banco, entao
  // criamos o perfil manualmente (1:1 com auth.users).
  await db.execute(sql`
    INSERT INTO public.profiles (id, full_name)
    VALUES (${id}, 'Mercado Pago Test User')
    ON CONFLICT (id) DO NOTHING
  `);

  return id;
}

/** Garante uma assinatura Pro ativa para o usuario de teste. */
async function ensureProSubscription(userId: string) {
  const plan = await PlanRepository.findByCode("pro");
  if (!plan) {
    throw new Error("Plano 'pro' nao encontrado no catalogo.");
  }

  const active = await SubscriptionRepository.findActiveByUser(userId);
  if (active) {
    console.log(`[INFO] Assinatura Pro ja ativa (id=${active.id}). Reutilizando.`);
    return active;
  }

  const row = await SubscriptionRepository.create({
    userId,
    planId: plan.id,
    status: "active",
    startsAt: new Date(),
    endsAt: null,
    preapprovalId: null,
  });
  console.log(`[INFO] Assinatura Pro criada (id=${row.id}).`);
  return row;
}

async function main() {
  console.log("=== Criar usuario de teste do Mercado Pago ===");

  // 1) Cria o usuario de teste no MP.
  const mpUser = await createMpTestUser();
  console.log(`[INFO] MP test_user criado: ${mpUser.email} (id=${mpUser.id})`);

  // 2) Insere/atualiza no banco local.
  const userId = await upsertLocalUser(mpUser.email);
  console.log(`[INFO] Usuario local criado: ${userId}`);

  // 3) Garante assinatura Pro.
  await ensureProSubscription(userId);

  // 4) Salva o estado para os demais scripts.
  const state = { email: mpUser.email, mpUserId: mpUser.id, userId };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`[INFO] Estado salvo em ${STATE_FILE}`);

  // 5) Saida final.
  console.log(`\n✅ Usuário de teste MP criado: ${mpUser.email} (userId: ${userId}) - salvo em .mp-test-user.json`);
}

main().catch((err) => {
  console.error("\n[ERRO] Erro inesperado:", err);
  process.exit(1);
});

