import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

/**
 * Robots.txt (app/robots.ts).
 * Permite indexação das páginas públicas e bloqueia áreas autenticadas/API.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/cadastro"],
        disallow: [
          "/admin/",
          "/dashboard",
          "/api/",
          "/apostilas",
          "/questoes",
          "/professor",
          "/redacao",
          "/configuracoes",
          "/sessao",
          "/recuperar-senha",
        ],
      },
    ],
    sitemap: `${publicEnv.appUrl}/sitemap.xml`,
  };
}
