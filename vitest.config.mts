import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Foco em lógica de domínio/serviços (não em rotas/UI/boilerplate).
      include: [
        "src/lib/**/*.ts",
        "src/lib/**/*.tsx",
        "src/db/**/*.ts",
      ],
      exclude: [
        "src/lib/**/__tests__/**",
        "src/lib/**/*.test.ts",
        "src/lib/**/*.spec.ts",
        "src/lib/db/schema/**",
        "src/lib/db/migrations/**",
        "src/lib/supabase/database.types.ts",
        "src/lib/**/index.ts",
        "src/lib/**/*.d.ts",
      ],
      thresholds: {
        // Linha de base atual (2026-08-22):
        //   Statements 51.83% | Branches 45.14% | Functions 35% | Lines 53.94%
        // Aumentar conforme a cobertura melhora.
        lines: 50,
        functions: 30,
        branches: 40,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Em testes, `server-only` é um no-op (em runtime do Next.js ele
      // bloqueia importação em Client Components).
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url)
      ),
    },
  },
});
