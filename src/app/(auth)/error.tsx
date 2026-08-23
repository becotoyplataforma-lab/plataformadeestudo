"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary do segmento (auth).
 * Exibe mensagem amigável em português, sem stack traces, com botão de
 * recarregar. Loga o erro no console para diagnóstico.
 */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Loga o erro para diagnóstico, sem expor ao usuário.
    console.error("Erro na autenticação:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-cyan-400">
        Ops, algo deu errado
      </p>
      <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
        Erro na autenticação
      </h1>
      <p className="mt-4 max-w-md text-slate-400">
        Ocorreu um erro inesperado ao carregar esta página. Tente recarregar a
        página. Se o problema persistir, volte mais tarde.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Tentar novamente</Button>
        <Button variant="ghost" onClick={() => (window.location.href = "/")}>
          Ir para o início
        </Button>
      </div>
    </main>
  );
}
