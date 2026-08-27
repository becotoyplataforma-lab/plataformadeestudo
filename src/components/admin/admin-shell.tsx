"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminSidebar } from "./admin-sidebar";
import { AdminNavContent } from "./admin-nav";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserMenu } from "@/components/layout/user-menu";

const BREADCRUMB_LABELS: Record<string, string> = {
  alunos: "Alunos",
  concursos: "Concursos/Editais",
  editais: "Editais",
  importar: "Importar (URL)",
  materias: "Matérias",
  apostilas: "Apostilas",
  revisao: "Revisão",
  fontes: "Fontes externas",
  questoes: "Questões",
  gerar: "Gerar questões",
  aulas: "Aulas",
  avatares: "Avatares",
  ia: "IA",
  financeiro: "Financeiro",
  assinaturas: "Assinaturas",
  pagamentos: "Pagamentos",
};

const FULL_PATH_LABELS: Record<string, string> = {
  "/admin/editais/importar": "Edital IA",
  "/admin/importar": "Importar (URL)",
  "/admin/apostilas/revisao": "Revisão material",
  "/admin/questoes/importar": "Importar questões",
  "/admin/questoes/revisao": "Revisão de questões",
  "/admin/questoes/gerar": "Gerar questões",
};

function breadcrumbItems(pathname: string): string[] {
  if (pathname === "/admin") return ["Admin", "Dashboard"];
  const full = "/" + pathname.split("/").filter(Boolean).join("/");
  if (FULL_PATH_LABELS[full]) return ["Admin", FULL_PATH_LABELS[full]];
  const segs = pathname.split("/").filter(Boolean).slice(1); // remove "admin"
  const labels = segs.map((s) => BREADCRUMB_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1));
  return ["Admin", ...labels];
}

export function AdminShell({
  name,
  email,
  children,
}: {
  name?: string | null;
  email?: string | null;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const crumbs = breadcrumbItems(pathname);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.08),transparent_40%),#070b14] text-slate-200">
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div
        className={cn(
          "transition-[padding] duration-200 ease-in-out",
          collapsed ? "lg:pl-16" : "lg:pl-64"
        )}
      >
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-white/10 bg-[#0b1120]/90 px-4 backdrop-blur">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-[#0b1120] p-0 text-slate-200">
              <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/25 to-blue-500/25 text-sm font-black text-cyan-300 ring-1 ring-inset ring-cyan-400/30">
                  C
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-[15px] font-bold text-white">ConcursoAI</span>
                  <span className="truncate text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300">
                    Área administrativa
                  </span>
                </span>
              </div>
              <TooltipProvider delayDuration={0}>
                <AdminNavContent onNavigate={() => setMobileOpen(false)} />
              </TooltipProvider>
            </SheetContent>
          </Sheet>

          <nav
            className="flex min-w-0 items-center gap-1 overflow-hidden text-sm text-slate-400"
            aria-label="breadcrumb"
          >
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1 whitespace-nowrap">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
                <span className={i === crumbs.length - 1 ? "font-medium text-slate-200" : ""}>
                  {c}
                </span>
              </span>
            ))}
          </nav>

          <div className="ml-auto shrink-0">
            <UserMenu name={name} email={email} />
          </div>
        </header>

        <main className="p-4 md:p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
