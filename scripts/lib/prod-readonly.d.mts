/**
 * Tipos de scripts/lib/prod-readonly.mjs. O handle e tipado pelo minimo que usamos
 * (unsafe) para o teste poder passar um stub sem depender do driver.
 */

export declare function assertReadOnlySession(sql: {
  unsafe: (query: string) => Promise<unknown>;
}): Promise<string>;
