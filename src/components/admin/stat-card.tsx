import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type TrendDirection = "up" | "down" | "neutral";

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
}: StatCardProps) {
  const content = (
    <Card
      className={cn(
        "group relative overflow-hidden border-white/10 bg-white/[0.03] backdrop-blur-sm",
        "transition-all duration-200",
        href &&
          "hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-white/[0.05] hover:shadow-lg hover:shadow-cyan-500/5",
        className
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {label}
            </p>
            {loading ? (
              <Skeleton className="mt-2 h-8 w-24" />
            ) : (
              <p className="mt-1.5 truncate text-2xl font-bold tracking-tight text-slate-100">
                {value}
              </p>
            )}
            {trend && !loading && (
              <div className="mt-2 flex items-center gap-1">
                {(() => {
                  const TrendIcon = TREND_STYLES[trend.direction].icon;
                  return (
                    <TrendIcon
                      className={cn("h-3.5 w-3.5", TREND_STYLES[trend.direction].className)}
                    />
                  );
                })()}
                <span className="text-xs font-medium text-slate-400">{trend.text}</span>
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                "bg-white/5 ring-1 ring-inset ring-white/10",
                iconClassName
              )}
            >
              <Icon className="h-5 w-5" />
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
