import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, BrainCircuit } from "lucide-react";

// Área autenticada: não deve ser indexada por buscadores.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Layout do grupo (study) — modo foco, sem sidebar.
 * Usado para sessões de estudo imersivas.
 */
export default function StudyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-background">
      <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
            <BrainCircuit className="h-5 w-5" />
          </span>
          <span>
            Concurso<span className="text-blue-600">AI</span>
          </span>
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao painel
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center p-4">{children}</main>
    </div>
  );
}
