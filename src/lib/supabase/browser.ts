/**
 * ConcursoAI - Cliente Supabase do navegador (publicavel por definicao).
 *
 * Usado apenas pelo fluxo de recuperacao de senha, que precisa concluir a troca com a
 * sessao de recovery trazida no fragmento do link. A chave aqui e a anonima publica
 * (NEXT_PUBLIC_SUPABASE_ANON_KEY): a service role permanece exclusivamente no servidor
 * em src/lib/supabase/admin.ts e nunca chega a este modulo.
 */
import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
