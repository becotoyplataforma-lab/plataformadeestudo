import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Saída standalone — necessária para o deploy em Docker (infra/Dockerfile)
  output: "standalone",

  reactStrictMode: true,
  // Remove o header "X-Powered-By: Next.js" (reduz fingerprinting do servidor).
  poweredByHeader: false,
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
  // Configuração para permitir streaming nas respostas de IA
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
