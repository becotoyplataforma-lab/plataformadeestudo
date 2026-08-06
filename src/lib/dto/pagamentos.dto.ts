import { z } from "zod";
import { parseDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";

/** DTO de resposta do checkout (POST /api/payments/checkout). */
export const CheckoutDtoSchema = z.object({
  init_point: z.string().url(),
  sandbox_init_point: z.string().url(),
  external_reference: z.string(),
  plan: z.enum(["pro", "intensivo"]),
});
export type CheckoutDto = OutputOf<typeof CheckoutDtoSchema>;

export function toCheckoutDto(input: unknown): CheckoutDto | null {
  return parseDto(CheckoutDtoSchema, input);
}

/** DTO de pagamento registrado (tabela `payments`). */
export const PaymentDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider: z.string(),
  provider_id: z.string().nullable(),
  plan: z.enum(["free", "pro", "intensivo"]),
  amount_cents: z.number().int().min(0),
  status: z.string(),
  external_reference: z.string().nullable(),
  paid_at: z.string().nullable(),
  created_at: z.string(),
});
export type PaymentDto = OutputOf<typeof PaymentDtoSchema>;

export function toPaymentDto(input: unknown): PaymentDto | null {
  return parseDto(PaymentDtoSchema, input);
}
