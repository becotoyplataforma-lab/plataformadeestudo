"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary global (App Router).
 * Exibe uma mensagem amigável em português, sem stack traces, com botão
 * de recarregar. Loga o erro no console para diagnóstico.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Loga o erro no servidor/cliente para diagnóstico, sem expor ao usuário.
    console.error("Erro global capturado:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="bg-[#03050a] text-slate-50">
        <div className="fixed inset-0 -z-10 bg-matrix-gradient" aria-hidden="true" />
        <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-cyan-400">
            Ops, algo deu errado
          </p>
          <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            Não conseguimos carregar esta página
          </h1>
          <p className="mt-4 max-w-md text-slate-400">
            Ocorreu um erro inesperado. Tente recarregar a página. Se o problema
            persistir, volte mais tarde.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={reset}>Tentar novamente</Button>
            <Button variant="ghost" onClick={() => (window.location.href = "/")}>
              Ir para o início
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
