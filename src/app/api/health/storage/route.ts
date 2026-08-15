/**
 * GET /api/health/storage — backend de storage ativo + status de IA (booleans).
 * Público (sem dados sensíveis).
 */
import { NextResponse } from "next/server";
import { storageBackend } from "@/lib/knowledge/storage.service";
import { isR2Configured } from "@/lib/knowledge/storage/r2-storage.service";

export async function GET() {
  return NextResponse.json({
    storage: {
      backend: storageBackend(),
      r2Configured: isR2Configured(),
    },
    ai: {
      deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
      embeddingConfigured: Boolean(process.env.EMBEDDING_API_URL),
    },
  });
}
