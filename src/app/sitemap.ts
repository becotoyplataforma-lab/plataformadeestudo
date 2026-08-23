import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

/**
 * Sitemap (app/sitemap.ts).
 * Lista as URLs públicas indexáveis. Áreas autenticadas (dashboard, admin,
 * study) e de auth (login/cadastro) são excluídas via robots noindex.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicEnv.appUrl;
  const now = new Date();

  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${base}/cadastro`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
