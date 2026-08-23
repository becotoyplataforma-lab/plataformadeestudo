/**
 * Loading global (App Router).
 * Exibido enquanto uma rota carrega. Spinner simples e discreto.
 */
export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400"
        role="status"
        aria-label="Carregando"
      />
      <p className="mt-4 text-sm text-slate-400">Carregando…</p>
    </main>
  );
}
