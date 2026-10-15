/**
 * Tipos do espelho fail-closed usado pelos scripts .mjs.
 * A politica autoritativa esta em src/lib/db/env-guard.ts; a paridade e vigiada
 * por src/lib/db/__tests__/script-db-safety-parity.test.ts.
 */

export declare const NON_PRODUCTION_DATABASE_REQUIRED: "NON_PRODUCTION_DATABASE_REQUIRED";
export declare const SCRIPT_DB_BLOCKED_EXIT_CODE: 3;
export declare const DATABASE_ENV_KEYS: readonly string[];

export type ScriptDatabaseOrigin = "vitest" | "playwright" | "nextjs" | "cli" | "unknown";

export type ScriptDatabaseOverrides = {
  nodeEnv?: string;
  origin?: ScriptDatabaseOrigin;
  productionRef?: string | null;
  safeRefs?: string[];
};

export type ScriptDatabaseVerdict = {
  safe: boolean;
  reason: string;
  hostname?: string;
  database?: string;
  projectRef?: string;
  productionProjectRef?: string;
};

export declare function evaluateScriptDatabaseSafety(
  rawUrl?: string,
  env?: NodeJS.ProcessEnv,
  overrides?: ScriptDatabaseOverrides,
): ScriptDatabaseVerdict;

export declare function productionProjectRefFromEnv(env?: NodeJS.ProcessEnv): string | null;
export declare function safeTestProjectRefsFromEnv(env?: NodeJS.ProcessEnv): string[];
export declare function detectScriptOrigin(env?: NodeJS.ProcessEnv): ScriptDatabaseOrigin;

export declare class ScriptDatabaseBlockedError extends Error {
  readonly code: typeof NON_PRODUCTION_DATABASE_REQUIRED;
  readonly target: string;
  readonly reason: string;
  constructor(target: string, reason: string);
}

export declare function describeScriptDatabaseTarget(
  target: string,
  rawUrl?: string,
  env?: NodeJS.ProcessEnv,
  overrides?: ScriptDatabaseOverrides,
): string;

export declare function assertScriptDatabaseTarget(
  target: string,
  rawUrl?: string,
  env?: NodeJS.ProcessEnv,
  overrides?: ScriptDatabaseOverrides,
): ScriptDatabaseVerdict;

export declare function guardScriptDatabaseTargetOrExit(
  target: string,
  rawUrl?: string,
  env?: NodeJS.ProcessEnv,
): ScriptDatabaseVerdict;

export declare function readDatabaseEnvKeys(
  fs: { readFileSync: (path: string, encoding: string) => string },
  filePath: string,
): Record<string, string>;

export declare function mergeDatabaseEnv(
  fs: { readFileSync: (path: string, encoding: string) => string },
  env: NodeJS.ProcessEnv,
  root: string,
  files: readonly string[],
): NodeJS.ProcessEnv;
