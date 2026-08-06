import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { publicEnv } from "@/lib/env";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "ConcursoAI — Estudos com IA para concursos públicos",
    template: "%s · ConcursoAI",
  },
  description:
    "Plataforma de estudos com inteligência artificial para concursos públicos brasileiros: cronograma, questões, flashcards, Professor IA e análises de desempenho.",
  keywords: [
    "concurso público",
    "estudos",
    "questões",
    "cronograma",
    "IA",
    "flashcards",
  ],
  authors: [{ name: "ConcursoAI" }],
  openGraph: {
    title: "ConcursoAI — Estudos com IA para concursos públicos",
    description:
      "Cronograma inteligente, banco de questões, flashcards e Professor IA para você passar no concurso.",
    url: publicEnv.appUrl,
    siteName: "ConcursoAI",
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
