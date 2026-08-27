/**
 * Admin — Financeiro: helpers de formatação e badges (compartilhados)
 */
import { Badge } from "@/components/ui/badge";
import type { SubscriptionStatus, PaymentStatus } from "@/lib/billing/types";

/** Formata centavos em BRL. */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/** Formata data ISO para dd/mm/aaaa (ou "—" se ausente). */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

/** Badge de status de assinatura. */
export function SubscriptionStatusBadge({
  status,
}: {
  status: SubscriptionStatus;
}) {
  const map: Record<SubscriptionStatus, { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "outline" }> = {
    active: { label: "Ativa", variant: "success" },
    past_due: { label: "Past due", variant: "warning" },
    cancelled: { label: "Cancelada", variant: "destructive" },
    expired: { label: "Expirada", variant: "outline" },
    suspended: { label: "Suspensa", variant: "secondary" },
  };
  const m = map[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

/** Badge de status de pagamento. */
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { label: string; variant: "success" | "warning" | "destructive" | "outline" | "secondary" }> = {
    approved: { label: "Aprovado", variant: "success" },
    pending: { label: "Pendente", variant: "warning" },
    rejected: { label: "Rejeitado", variant: "destructive" },
    cancelled: { label: "Cancelado", variant: "secondary" },
    refunded: { label: "Reembolsado", variant: "outline" },
  };
  const m = map[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
