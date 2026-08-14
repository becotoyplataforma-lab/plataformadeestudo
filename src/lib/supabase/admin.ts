import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Cliente Supabase ADMIN (service role).
 * USO EXCLUSIVO EM SERVIDOR — nunca importe em Client Components.
 * Bypassa RLS; deve ser usado apenas para operações de sistema
 * (ex.: funções RPC DEFINER, jobs, admin).
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
  }
  return createClient(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
