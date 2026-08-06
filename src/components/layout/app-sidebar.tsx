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
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
            {item.href === "/professor" && (
              <span className="ml-auto rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
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
    <Link href="/dashboard" className="flex items-center gap-2 px-3 py-4 font-bold text-lg">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
        <BrainCircuit className="h-5 w-5" />
      </span>
      <span>
        Concurso<span className="text-blue-600">AI</span>
      </span>
    </Link>
  );
}

export function SidebarStreak({ days }: { days: number }) {
  return (
    <div className="mx-3 mb-3 rounded-xl border bg-gradient-to-br from-orange-50 to-amber-50 p-3 dark:from-orange-950/30 dark:to-amber-950/30">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600">
          <Flame className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold leading-none">
            {days} {days === 1 ? "dia" : "dias"} seguidos
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Continue assim! 🔥</p>
        </div>
      </div>
    </div>
  );
}
