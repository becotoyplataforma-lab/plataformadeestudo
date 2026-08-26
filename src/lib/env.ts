import { z } from "zod";

/**
 * Validação de variáveis de ambiente (fail-fast em build).
 * Importe apenas em módulos de servidor.
 */

/**
 * Converte string vazia em `undefined` para que variáveis opcionais
 * presentes mas vazias no .env não quebrem a validação (ex.: EMBEDDING_API_URL).
 */
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("ConcursoAI"),
  // AUTH_SECRET: em produção é OBRIGATÓRIO e com mínimo de 32 chars (fail-fast).
  // Em dev/teste, um default local permite rodar sem configurar. Nunca use o
  // default em produção — o refinamento abaixo força o crash na startup.
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET deve ter pelo menos 32 caracteres")
    .default("dev-secret-change-me-please-set-a-real-secret-32chars"),

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

  // Kimi / Moonshot (API compatível com OpenAI).
  KIMI_API_KEY: z.string().optional(),
  KIMI_BASE_URL: z.string().url().default("https://api.moonshot.ai/v1"),

  // Serviço de embeddings (BAAI/bge-m3 — self-hosted ou API).
  // Obrigatório em produção para ativar a busca vetorial (docs/10-EMBEDDING-STANDARD).
  EMBEDDING_API_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  EMBEDDING_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default("BAAI/bge-m3"),
  EMBEDDING_DIMENSION: z.coerce.number().int().default(1024),

  // Cloudflare R2 (storage S3-compatível). Opcional: sem config, usa Supabase Storage.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
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

// Fail-fast de segurança: em produção, AUTH_SECRET NUNCA pode ser o default
// de desenvolvimento. Se não foi definido explicitamente no ambiente, o app
// deve crashar na startup em vez de rodar com uma chave de assinatura pública.
const isNextProductionBuild =
  process.env.NEXT_PHASE === "phase-production-build";

if (
  process.env.NODE_ENV === "production" &&
  !isNextProductionBuild &&
  (!process.env.AUTH_SECRET ||
    process.env.AUTH_SECRET === "dev-secret-change-me" ||
    process.env.AUTH_SECRET ===
      "dev-secret-change-me-please-set-a-real-secret-32chars")
) {
  throw new Error(
    "AUTH_SECRET is required in production. Defina uma chave forte (>= 32 chars) no .env.production."
  );
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
