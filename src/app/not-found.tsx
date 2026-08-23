import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Página 404 global (App Router).
 * Mensagem amigável em português com link para o início.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-cyan-400">
        Erro 404
      </p>
      <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
        Página não encontrada
      </h1>
      <p className="mt-4 max-w-md text-slate-400">
        A página que você procura não existe ou foi movida. Verifique o endereço
        ou volte para o início.
      </p>
      <div className="mt-8">
        <Button asChild>
          <Link href="/">Voltar para o início</Link>
        </Button>
      </div>
    </main>
  );
}
