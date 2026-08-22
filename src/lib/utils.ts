import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina classes Tailwind com shadcn/ui */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata minutos como "1h 30min" */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** Formata percentual (0.785 → 78,5%) */
export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toLocaleString("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}%`;
}

/** Primeiro nome de um nome completo */
export function firstName(fullName?: string | null): string {
  if (!fullName) return "Aluno";
  return fullName.trim().split(" ")[0];
}

/** Iniciais para avatar */
export function initials(name?: string | null): string {
  if (!name) return "A";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}


