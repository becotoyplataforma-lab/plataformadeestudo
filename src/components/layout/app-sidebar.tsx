"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BrainCircuit,
  CalendarCheck2,
  FileQuestion,
  Flame,
  Layers,
  LayoutDashboard,
  LineChart,
  MessagesSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cronograma", label: "Cronograma", icon: CalendarCheck2 },
  { href: "/questoes", label: "Questões", icon: FileQuestion },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/professor", label: "Professor IA", icon: MessagesSquare },
  { href: "/analises", label: "Analíticas", icon: LineChart },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {navItems.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold tracking-[-0.01em] transition-all duration-200",
              active
                ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/12 text-white shadow-[inset_0_0_0_1px_rgba(6,182,212,0.3)]"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
            {item.href === "/professor" && (
              <span className="ml-auto rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white shadow-lg shadow-cyan-500/30">
                IA
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarBrand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-4 py-5 text-lg font-extrabold tracking-[-0.04em] text-white">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-600 shadow-[0_10px_30px_rgba(6,182,212,0.4)]">
        <BrainCircuit className="h-5 w-5 text-white" />
      </span>
      <span>
        Concurso<span className="text-cyan-400">AI</span>
      </span>
    </Link>
  );
}

export function SidebarStreak({ days }: { days: number }) {
  return (
    <div className="mx-3 mb-3 rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/12 to-amber-500/10 p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
          <Flame className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold leading-none text-white">
            {days} {days === 1 ? "dia" : "dias"} seguidos
          </p>
          <p className="mt-1 text-xs text-slate-300">Continue assim! 🔥</p>
        </div>
      </div>
    </div>
  );
}
