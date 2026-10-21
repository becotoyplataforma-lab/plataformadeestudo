import type { NextConfig } from "next";
import { buildCspHeader } from "./src/lib/security/csp";

const nextConfig: NextConfig = {
  // Saída standalone — necessária para o deploy em Docker (infra/Dockerfile)
  output: "standalone",
  typescript: { ignoreBuildErrors: true },

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
};

export default nextConfig;
