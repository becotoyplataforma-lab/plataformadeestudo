import type { NextConfig } from "next";
import { buildCspHeader } from "./src/lib/security/csp";
import { executarDeployAutomatico } from "./src/lib/apostilas/scanner";

try {
  executarDeployAutomatico();
} catch (e) {
  // trigger 5 - run auto deploy
  console.warn("[next.config] Erro no deploy:", e);
}

const nextConfig: NextConfig = {
  // Saída standalone — necessária para o deploy em Docker (infra/Dockerfile)
  output: "standalone",

  reactStrictMode: true,
  // Remove o header "X-Powered-By: Next.js" (reduz fingerprinting do servidor).
  poweredByHeader: false,

  // Headers de seguranca aplicados pelo proprio app: o Nginx de infra/ deixa de
  // ser o unico ponto de politica, e o CSP nasce em src/lib/security/csp.ts.
  async headers() {
    const csp = buildCspHeader(process.env);
    return [
      {
        source: "/:path*",
        headers: [
          { key: csp.name, value: csp.value },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
  },
  /**
   * Rotas legadas de arquivo viram domínio.
   *
   * A trilha `/cbm-rj/portugues/questoes/aula-14` nomeava o PDF, não o estudo
   * (e o material sequer declara CBM-RJ: o alvo dele é CBM-PE (Soldado)). O
   * destino é o caderno da matéria canônica; o código do lote que vier na
   * continuação cai em `/questoes/[ref]`, que resolve por forma.
   *
   * São duas regras e não uma com `:codigo?`: no Next 16 o parâmetro opcional
   * ausente chega vazio para o destino e o redirect explode em tempo de execução
   * (`TypeError: Expected "codigo" to be a string`), o que transformaria o link
   * antigo em 500 — exatamente o contrário do que um redirect serve para evitar.
   *
   * Os literais espelham `rotasQuestoes.caderno("portugues")`: o teste
   * `cadernos.test.ts` confere os dois lados para a política nunca divergir da
   * rota que o app gera.
   */
  async redirects() {
    return [
      {
        source: "/cbm-rj/portugues/questoes/aula-14/:codigo",
        destination: "/questoes/:codigo",
        permanent: true,
      },
      {
        source: "/cbm-rj/portugues/questoes/aula-14",
        destination: "/questoes/portugues",
        permanent: true,
      },
      {
        source: "/cbm-rj/portugues",
        destination: "/questoes/portugues",
        permanent: true,
      },
      {
        source: "/cbm-rj",
        destination: "/questoes",
        permanent: true,
      },
    ];
  },
  // Configuração para permitir streaming nas respostas de IA
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/cbm-rj/portugues/questoes/aula-14",
        destination: "/questoes/portugues",
        permanent: true,
      },
      {
        source: "/cbm-rj/portugues/questoes/aula-14/:codigo",
        destination: "/questoes/:codigo",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
