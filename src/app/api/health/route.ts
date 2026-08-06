/**
 * GET /api/health — health check para monitoramento de deploy.
 */
export async function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    app: process.env.NEXT_PUBLIC_APP_NAME ?? "ConcursoAI",
  });
}
