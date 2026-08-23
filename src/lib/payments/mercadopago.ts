import "server-only";

/**
 * Cliente Mercado Pago (API oficial).
 * USO EXCLUSIVO EM SERVIDOR — o access token nunca vai ao frontend.
 *
 * Documentação: https://www.mercadopago.com.br/developers/pt/reference
 */

const MP_BASE_URL = "https://api.mercadopago.com";

function getAccessToken(): string {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado no servidor.");
  }
  return token;
}

interface MpRequestOptions {
  method?: "GET" | "POST" | "PUT";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>({ method = "GET", path, body, headers }: MpRequestOptions): Promise<T> {
  const res = await fetch(`${MP_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mercado Pago erro ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

export interface PaymentNotification {
  id?: string | number;
  action?: string;
  type?: string;
  data?: { id?: string | number };
}

/** Busca o pagamento por ID (para confirmar status no webhook). */
export async function getPayment(paymentId: string) {
  return request<{
    id: number;
    status: string; // approved, pending, rejected, cancelled
    status_detail: string;
    external_reference?: string | null;
    transaction_amount?: number;
    date_approved?: string;
  }>({ path: `/v1/payments/${paymentId}` });
}

// ============================================================
// ASSINATURAS RECORRENTES (Preapproval)
// ============================================================

export interface Preapproval {
  id: string;
  status: string; // pending, authorized, paused, cancelled, finished
  reason: string;
  external_reference?: string | null;
  init_point?: string;
  sandbox_init_point?: string;
  auto_recurring?: {
    frequency: number;
    frequency_type: string; // "months" | "days"
    transaction_amount: number;
    currency_id: string;
  };
}

/**
 * Cria uma Preapproval (assinatura recorrente) no Mercado Pago.
 * - Cobrança automática mensal (auto_recurring.frequency = 1, months).
 * - external_reference: "plano:userId" — usada no webhook para identificar.
 */
export async function createPreapproval(params: {
  externalReference: string; // ex.: "pro:uuid-do-usuario"
  reason: string;
  unitPriceCents: number;
  payerEmail?: string; // obrigatório no MP para criar preapproval
  notificationUrl?: string;
  successUrl?: string;
  failureUrl?: string;
}): Promise<Preapproval> {
  const body = {
    reason: params.reason,
    external_reference: params.externalReference,
    // A API de preapproval do MP espera `payer_email` no topo do body
    // (NAO aninhado em `payer.email`).
    payer_email: params.payerEmail,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: params.unitPriceCents / 100,
      currency_id: "BRL",
    },
    notification_url:
      params.notificationUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/billing/webhook`,
    back_url: params.successUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes?pagamento=sucesso`,
  };

  return request<Preapproval>({
    method: "POST",
    path: "/preapproval",
    body,
  });
}

/** Busca uma Preapproval por ID (para confirmar status no webhook). */
export async function getPreapproval(preapprovalId: string) {
  return request<Preapproval>({ path: `/preapproval/${preapprovalId}` });
}
