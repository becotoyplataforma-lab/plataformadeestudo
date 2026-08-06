import type { Plan } from "@/types";

/**
 * Definição dos planos e preços.
 * A fonte da verdade do plano do usuário é `profiles.plano`.
 */
export interface PlanDefinition {
  id: Plan;
  name: string;
  /** Preço mensal em centavos (para o Mercado Pago) */
  amountCents: number;
  priceLabel: string;
  description: string;
  /** Referência externa no Mercado Pago (para assinaturas) */
  externalPlanId?: string;
}

export const PLANS: Record<Plan, PlanDefinition> = {
  free: {
    id: "free",
    name: "Gratuito",
    amountCents: 0,
    priceLabel: "R$ 0",
    description: "Cronograma, 20 questões/dia, 50 mensagens IA (Flash), flashcards.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    amountCents: 2990, // R$ 29,90
    priceLabel: "R$ 29,90",
    description: "Questões ilimitadas, IA Flash + Pro, analíticas avançadas.",
    externalPlanId: "concursoai-pro",
  },
  intensivo: {
    id: "intensivo",
    name: "Intensivo",
    amountCents: 4990, // R$ 49,90
    priceLabel: "R$ 49,90",
    description: "Tudo do Pro + Knowledge Engine, simulados, prioridade.",
    externalPlanId: "concursoai-intensivo",
  },
};

export function getPlan(id: Plan): PlanDefinition {
  return PLANS[id] ?? PLANS.free;
}
