import type { MetadataRoute } from "next";

/**
 * Manifest PWA (app/manifest.ts).
 * Define nome, ícones e tema para instalação/atalho.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ConcursoAI — Estudos com IA para concursos públicos",
    short_name: "ConcursoAI",
    description:
      "Cronograma inteligente, banco de questões, flashcards e Professor IA para você passar no concurso.",
    start_url: "/",
    display: "standalone",
    background_color: "#03050a",
    theme_color: "#03050a",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
