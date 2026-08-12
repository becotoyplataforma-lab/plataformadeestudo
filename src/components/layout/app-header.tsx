"use client";

import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UserMenu } from "@/components/layout/user-menu";
import { SidebarBrand, SidebarNav, SidebarStreak } from "@/components/layout/app-sidebar";

interface HeaderProps {
  streakDays: number;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
}

/** Cabeçalho da área autenticada (com menu mobile). */
export function AppHeader({
  streakDays,
  userName,
  userEmail,
  userImage,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-slate-950/65 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-r border-white/10 bg-slate-950 p-0 text-white">
            <div className="flex h-full flex-col">
              <SidebarBrand />
              <SidebarStreak days={streakDays} />
              <SidebarNav />
            </div>
          </SheetContent>
        </Sheet>

        <div className="hidden items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-200 md:inline-flex">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]" />
          Plataforma ativa
        </div>

        <p className="text-sm font-semibold tracking-[-0.02em] text-slate-300">
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      <UserMenu name={userName} email={userEmail} image={userImage} />
    </header>
  );
}
