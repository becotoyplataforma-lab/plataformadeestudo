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

export interface CheckoutItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number; // em centavos
}

export interface CheckoutPreference {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

/**
 * Cria uma preferência de checkout (pagamento único ou Pix).
 * - unit_price em centavos (ex.: 2990 = R$ 29,90).
 */
export async function createCheckoutPreference(params: {
  externalReference: string; // ex.: "pro:uuid-do-usuario"
  title: string;
  unitPriceCents: number;
  description?: string;
  notificationUrl?: string;
  successUrl?: string;
  failureUrl?: string;
}): Promise<CheckoutPreference> {
  const body = {
    items: [
      {
        id: params.externalReference,
        title: params.title,
        description: params.description ?? "Plano ConcursoAI",
        quantity: 1,
        unit_price: params.unitPriceCents,
        currency_id: "BRL",
      },
    ],
    payer: undefined,
    external_reference: params.externalReference,
    notification_url:
      params.notificationUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook`,
    back_urls: {
      success: params.successUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes?pagamento=sucesso`,
      failure: params.failureUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes?pagamento=falha`,
      pending: `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes?pagamento=pendente`,
    },
    auto_return: "approved",
    binary_mode: true,
  };

  return request<CheckoutPreference>({
    method: "POST",
    path: "/checkout/preferences",
    body,
  });
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
