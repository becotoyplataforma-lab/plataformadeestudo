"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

const items = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/alunos", label: "Alunos", icon: Users },
  { href: "/admin/concursos", label: "Concursos/Editais", icon: Trophy },
  { href: "/admin/editais/importar", label: "Edital IA", icon: Sparkles },
  { href: "/admin/materias", label: "Matérias", icon: BookOpen },
  { href: "/admin/apostilas", label: "Apostilas", icon: FileText },
  { href: "/admin/apostilas/revisao", label: "Revisão material", icon: ShieldCheck },
  { href: "/admin/importar", label: "Importar (URL)", icon: Globe },
  { href: "/admin/fontes", label: "Fontes externas", icon: Database },
  { href: "/admin/questoes", label: "Questões", icon: ListChecks },
  { href: "/admin/questoes/gerar", label: "Gerar questões", icon: Sparkles },
  { href: "/admin/questoes/importar", label: "Importar questões", icon: Upload },
  { href: "/admin/questoes/revisao", label: "Revisão", icon: ClipboardCheck },
  { href: "/admin/aulas", label: "Aulas", icon: PlayCircle },
  { href: "/admin/avatares", label: "Avatares", icon: UserRound },
  { href: "/admin/ia", label: "IA", icon: Cpu },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-inset ring-cyan-400/30"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
