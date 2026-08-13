/**
 * ConcursoAI — ENUMS compartilhados entre domínios (Drizzle ORM)
 *
 * Contém enums usados por mais de um domínio, evitando import circular
 * entre identity ⇄ contest (e outros). `identity.ts` reexporta `lifecycleStatus`
 * daqui para manter compatibilidade com imports existentes.
 *
 * Apenas schema/enums. Sem lógica de negócio.
 */
import { pgEnum } from "drizzle-orm/pg-core";

/** Estado genérico de ciclo de vida (lifecycle_status). */
export const lifecycleStatus = pgEnum("lifecycle_status", [
  "active",
  "inactive",
  "archived",
]);
