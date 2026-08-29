"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit } from "lucide-react";

/** Logo da landing page. Navega para "/" e, se já estiver na home, rola suavemente ao topo. */
export function LandingLogo() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <Link
      href="/"
      aria-label="ConcursoAI — voltar ao topo"
      onClick={(e) => {
        if (isHome) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }}
      className="flex items-center gap-2 font-extrabold text-lg tracking-tight"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 text-white">
        <BrainCircuit className="h-5 w-5" />
      </span>
      <span>
        Concurso<span className="text-cyan-400">AI</span>
      </span>
    </Link>
  );
}
