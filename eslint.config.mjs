import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ConcursoAI — ESLint 9 Flat Config
 *
 * Migração completa do .eslintrc.json (legado) para Flat Config,
 * conforme exigência da infraestrutura (Next.js 16 + ESLint 9).
 *
 * - Mantém as regras do next/core-web-vitals e next/typescript.
 * - Preserva as regras customizadas do .eslintrc.json anterior.
 * - Nenhuma regra de negócio alterada.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    "**/node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "drizzle/**",
    "next-env.d.ts",
  ]),

  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "react/no-unescaped-entities": "off",
    },
  },
]);

export default eslintConfig;
