"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarCheck2,
  Compass,
  FileQuestion,
  FileText,
  Flame,
  Layers,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  disabled?: boolean;
}

/** Navegação principal do aluno (padrão "Meus Cursos"). */
const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/catalogo",
    label: "Catálogo de Cursos",
    icon: Compass,
    badge: "Em breve",
    disabled: true,
  },
  { href: "/apostilas", label: "Minhas Apostilas", icon: BookOpen },
  { href: "/cronograma", label: "Trilhas Estratégicas", icon: CalendarCheck2 },
  { href: "/questoes", label: "Caderno de Questões", icon: FileQuestion },
  { href: "/analises", label: "Monitor de Performance", icon: BarChart3 },
  {
    href: "/simulados",
    label: "Simulados",
    icon: Target,
    badge: "Em breve",
    disabled: true,
  },
  { href: "/perfil", label: "Minhas Preferências", icon: Settings },
];

/** Ferramentas extras já existentes na plataforma. */
const extraItems: NavItem[] = [
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/professor", label: "Professor IA", icon: MessagesSquare, badge: "IA" },
  { href: "/professor-apostilas", label: "Apostilas (Professor)", icon: FileText },
];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active =
    !item.disabled &&
    (pathname === item.href || pathname.startsWith(item.href + "/"));

  const classes = cn(
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold tracking-[-0.01em] transition-all duration-200",
    item.disabled
      ? "cursor-not-allowed text-slate-500"
      : active
        ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/12 text-white shadow-[inset_0_0_0_1px_rgba(6,182,212,0.3)]"
        : "text-slate-300 hover:bg-white/5 hover:text-white"
  );

  const content = (
    <>
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em]",
            item.disabled
              ? "border border-white/10 bg-white/5 text-slate-400"
              : "bg-gradient-to-r from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/30"
          )}
        >
          {item.badge}
        </span>
      )}
    </>
  );

  if (item.disabled) {
    return (
      <span className={classes} aria-disabled="true" title="Em breve">
        {content}
      </span>
    );
  }

  return (
    <Link href={item.href} className={classes}>
      {content}
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {navItems.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}

      <div className="my-3 border-t border-white/10" />

      <p className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
        Ferramentas
      </p>
      {extraItems.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
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
