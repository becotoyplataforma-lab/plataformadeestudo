/**
 * GET /api/health — health check para monitoramento de deploy.
 */
/**
 * force-dynamic: o payload tem timestamp, entao nao pode ser pre-renderado
 * no build (monitoramento leria uma data congelada).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    app: process.env.NEXT_PUBLIC_APP_NAME ?? "ConcursoAI",
  });
}
