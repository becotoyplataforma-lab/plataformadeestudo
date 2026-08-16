"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AdminNavContent } from "./admin-nav";

export function AdminSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/10 bg-[#0b1120]/95 backdrop-blur transition-[width] duration-200 ease-in-out lg:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo / título */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 px-3",
          collapsed ? "justify-center" : "px-4"
        )}
      >
        <Link href="/admin" className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-sm font-black text-cyan-300 ring-1 ring-inset ring-cyan-400/30">
            C
          </span>
          {!collapsed && (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[15px] font-bold text-white">ConcursoAI</span>
              <span className="truncate text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300">
                Área administrativa
              </span>
            </span>
          )}
        </Link>
      </div>

      {/* Navegação (scroll independente) */}
      <AdminNavContent collapsed={collapsed} />

      {/* Toggle colapsar/expandir */}
      <div className="shrink-0 border-t border-white/10 p-2">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggle}
                className="flex w-full items-center justify-center rounded-lg px-2 py-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
                aria-label="Expandir menu"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expandir menu</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={onToggle}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
            aria-label="Recolher menu"
          >
            <PanelLeftClose className="h-4 w-4 shrink-0" />
            <span className="truncate">Recolher menu</span>
          </button>
        )}
      </div>
    </aside>
  );
}
