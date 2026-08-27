"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Users,
  Trophy,
  FileText,
  ListChecks,
  Sparkles,
  ClipboardCheck,
  PlayCircle,
  UserRound,
  Cpu,
  BookOpen,
  Globe,
  ShieldCheck,
  Database,
  Upload,
  BarChart3,
  DollarSign,
  CreditCard,
  Banknote,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Visão geral",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Pessoas",
    items: [{ href: "/admin/alunos", label: "Alunos", icon: Users }],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/admin/financeiro", label: "Visão geral", icon: DollarSign, exact: true },
      { href: "/admin/financeiro/assinaturas", label: "Assinaturas", icon: CreditCard },
      { href: "/admin/financeiro/pagamentos", label: "Pagamentos", icon: Banknote },
    ],
  },
  {
    label: "Concursos",
    items: [
      { href: "/admin/concursos", label: "Concursos/Editais", icon: Trophy },
      { href: "/admin/editais/importar", label: "Edital IA", icon: Sparkles },
      { href: "/admin/importar", label: "Importar (URL)", icon: Globe },
      { href: "/admin/contest-intelligence", label: "Intelligence", icon: BarChart3 },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { href: "/admin/materias", label: "Matérias", icon: BookOpen },
      { href: "/admin/apostilas", label: "Apostilas", icon: FileText },
      { href: "/admin/apostilas/revisao", label: "Revisão material", icon: ShieldCheck },
      { href: "/admin/fontes", label: "Fontes externas", icon: Database },
      { href: "/admin/aulas", label: "Aulas", icon: PlayCircle },
      { href: "/admin/avatares", label: "Avatares", icon: UserRound },
    ],
  },
  {
    label: "Questões",
    items: [
      { href: "/admin/questoes", label: "Questões", icon: ListChecks },
      { href: "/admin/questoes/gerar", label: "Gerar questões", icon: Sparkles },
      { href: "/admin/questoes/importar", label: "Importar questões", icon: Upload },
      { href: "/admin/questoes/revisao", label: "Revisão", icon: ClipboardCheck },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/ia", label: "IA", icon: Cpu },
      { href: "/admin/admins", label: "Administradores", icon: ShieldCheck },
    ],
  },
];

/**
 * Lista de navegação agrupada (usada na sidebar desktop e no drawer mobile).
 * `collapsed` exibe apenas ícones (com tooltip). `onNavigate` fecha o drawer.
 */
export function AdminNavContent({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      {ADMIN_NAV_GROUPS.map((group, groupIndex) => (
        <div
          key={group.label}
          className={cn(groupIndex > 0 && !collapsed && "mt-5 border-t border-white/5 pt-4")}
        >
          {!collapsed && (
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-cyan-500/15 text-cyan-200"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                    collapsed && "justify-center px-2"
                  )}
                >
                  {!collapsed && (
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-cyan-400 transition-opacity",
                        active ? "opacity-100" : "opacity-0"
                      )}
                    />
                  )}
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active
                        ? "text-cyan-300"
                        : "text-slate-500 group-hover:text-slate-300"
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <li key={item.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  </li>
                );
              }
              return <li key={item.href}>{link}</li>;
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
