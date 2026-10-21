/**
 * Variáveis de ambiente públicas (seguras para o cliente).
 * NUNCA adicione chaves secretas ou credenciais de servidor neste arquivo.
 */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "ConcursoAI",
  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "missing-anon-key",
} as const;
