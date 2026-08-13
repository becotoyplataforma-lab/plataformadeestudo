import { z } from "zod";

/**
 * Validação de variáveis de ambiente (fail-fast em build).
 * Importe apenas em módulos de servidor.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("ConcursoAI"),
  AUTH_SECRET: z.string().min(1).default("dev-secret-change-me"),

  // Placeholders permitem rodar/build local antes de configurar o Supabase.
  // Preencha o .env.local antes de usar de verdade.
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .default("https://placeholder.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default("missing-anon-key"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),

  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL_FLASH: z.string().default("deepseek-chat"),
  DEEPSEEK_MODEL_PRO: z.string().default("deepseek-reasoner"),

  // Provedor Muse/Meta — modelo "Muse 1.2" (3ª opção no chat, roteado por provider).
  // Chave e endpoint separados do DeepSeek; o endpoint deve servir o modelo
  // num formato compatível com chat/completions.
  MUSE_API_KEY: z.string().optional(),
  MUSE_BASE_URL: z.string().url().optional(),
  MUSE_MODEL: z.string().optional(),

  // Serviço de embeddings (BAAI/bge-m3 — self-hosted ou API).
  // Obrigatório em produção para ativar a busca vetorial (docs/10-EMBEDDING-STANDARD).
  EMBEDDING_API_URL: z.string().url().optional(),
  EMBEDDING_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default("BAAI/bge-m3"),
  EMBEDDING_DIMENSION: z.coerce.number().int().default(1024),
});

const result = serverEnvSchema.safeParse(process.env);

if (!result.success) {
  console.error(
    "❌ Variáveis de ambiente inválidas:",
    result.error.flatten().fieldErrors
  );
  // Em build, falhar é intencional para não deployar config errada.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Configuração de ambiente inválida.");
  }
}

// Todas as chaves têm default/opcional → env sempre definido em runtime.
export const env: z.infer<typeof serverEnvSchema> = result.success
  ? result.data
  : serverEnvSchema.parse({});

/** Chaves públicas (seguras para o cliente) */
// Usa os mesmos placeholders do schema para que o app rode localmente
// antes de configurar o Supabase de verdade. Preencha o .env.local
// (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) para produção.
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "ConcursoAI",
  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "missing-anon-key",
} as const;
