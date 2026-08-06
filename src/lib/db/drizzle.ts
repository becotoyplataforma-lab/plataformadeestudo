import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

/**
 * Singleton Drizzle client (lazy) para Server Components e Server Actions.
 *
 * A conexão NÃO é criada no import do módulo — é criada apenas no primeiro
 * acesso a `db`. Isso segue o padrão do projeto de permitir build local
 * sem credenciais reais (placeholders), evitando falha em build/time de
 * coleta de rotas quando DATABASE_URL ainda não está configurada.
 *
 * Uso em produção: configure DATABASE_URL (Supabase pooler/Postgres direto).
 */
type DrizzleDB = PostgresJsDatabase<typeof schema>;

let client: DrizzleDB | null = null;

function getClient(): DrizzleDB {
  if (client) return client;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não configurada. Configure a conexão PostgreSQL (Supabase pooler)."
    );
  }

  const pg = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  client = drizzle(pg, { schema });
  return client;
}

/**
 * Proxy lazy: qualquer acesso a `db.<método>` dispara a inicialização
 * sob demanda, mantendo a API idêntica ao cliente Drizzle.
 */
export const db: DrizzleDB = new Proxy({} as DrizzleDB, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
  has(_target, prop) {
    return prop in getClient();
  },
  ownKeys() {
    return Reflect.ownKeys(getClient());
  },
  getOwnPropertyDescriptor() {
    return { enumerable: true, configurable: true };
  },
});
