import Link from "next/link";
import type { Metadata } from "next";
import { BrainCircuit } from "lucide-react";

// Páginas de autenticação não devem ser indexadas por buscadores.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Layout do grupo (auth) — telas de autenticação com layout centrado.
 * NOTA: (auth) é apenas organização de rotas; URL permanece /login, /cadastro.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Barra superior */}
      <header className="container flex h-16 items-center">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
            <BrainCircuit className="h-5 w-5" />
          </span>
          <span>
            Concurso<span className="text-blue-600">AI</span>
          </span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="container pb-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ConcursoAI · Termos de uso · Política de privacidade
      </footer>
    </div>
  );
}
