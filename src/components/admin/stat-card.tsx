import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type TrendDirection = "up" | "down" | "neutral";

export type StatCardVariant = "default" | "finance" | "alert";

export interface StatCardProps {
  /** Rótulo exibido acima do valor. */
  label: string;
  /** Valor principal (já formatado). */
  value: string;
  /** Ícone opcional exibido no canto. */
  icon?: LucideIcon;
  /** Cor de destaque do ícone (classe tailwind). */
  iconClassName?: string;
  /** Tendência opcional — seta + cor. */
  trend?: {
    direction: TrendDirection;
    text: string;
  };
  /** Se true, exibe skeleton no lugar do valor. */
  loading?: boolean;
  /** Link opcional — se informado, o card vira um link clicável. */
  href?: string;
  /** Classe extra para o card. */
  className?: string;
  /** Variante visual do card. */
  variant?: StatCardVariant;
  /** Badge curto (ex.: "R$") ao lado do rótulo. */
  chip?: string;
}

const TREND_STYLES: Record<TrendDirection, { icon: LucideIcon; className: string }> = {
  up: { icon: ArrowUpRight, className: "text-emerald-400" },
  down: { icon: ArrowDownRight, className: "text-rose-400" },
  neutral: { icon: ArrowUpRight, className: "text-slate-400" },
};

/**
 * Card de estatística reutilizável para o painel admin.
 * Suporta valor grande, label, ícone, tendência e estado de loading.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  iconClassName,
  trend,
  loading = false,
  href,
  className,
  variant = "default",
  chip,
}: StatCardProps) {
  const variantStyles = {
    default: "border-white/10 bg-white/[0.04]",
    finance:
      "border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.06] to-transparent ring-1 ring-inset ring-emerald-400/10",
    alert: "border-rose-400/25 bg-rose-500/[0.05]",
  };

  const content = (
    <Card
      className={cn(
        "group relative overflow-hidden backdrop-blur-sm transition-all duration-200",
        variantStyles[variant],
        href &&
          "hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-cyan-500/10",
        className
      )}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
                {label}
              </p>
              {chip && (
                <span className="shrink-0 rounded-full bg-emerald-400/10 px-1.5 py-px text-[9px] font-bold text-emerald-300 ring-1 ring-inset ring-emerald-400/25">
                  {chip}
                </span>
              )}
            </div>
            {loading ? (
              <Skeleton className="mt-1.5 h-6 w-20 sm:h-7" />
            ) : (
              <p
                className={cn(
                  "mt-1 truncate text-lg font-bold tracking-tight sm:text-xl lg:text-2xl",
                  variant === "alert" ? "text-rose-100" : "text-slate-100"
                )}
              >
                {value}
              </p>
            )}
            {trend && !loading && (
              <div className="mt-1 flex items-center gap-1">
                {(() => {
                  const TrendIcon = TREND_STYLES[trend.direction].icon;
                  return (
                    <TrendIcon
                      className={cn("h-3 w-3", TREND_STYLES[trend.direction].className)}
                    />
                  );
                })()}
                <span className="truncate text-[10px] font-medium text-slate-400 sm:text-xs">
                  {trend.text}
                </span>
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl",
                "bg-white/5 ring-1 ring-inset ring-white/10",
                iconClassName
              )}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
