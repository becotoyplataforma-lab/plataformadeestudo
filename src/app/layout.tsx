import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { publicEnv } from "@/lib/env";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.appUrl),
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
  creator: "ConcursoAI",
  publisher: "ConcursoAI",
  applicationName: "ConcursoAI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "ConcursoAI — Estudos com IA para concursos públicos",
    description:
      "Cronograma inteligente, banco de questões, flashcards e Professor IA para você passar no concurso.",
    url: publicEnv.appUrl,
    siteName: "ConcursoAI",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "ConcursoAI — Estudos com IA para concursos públicos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ConcursoAI — Estudos com IA para concursos públicos",
    description:
      "Cronograma inteligente, banco de questões, flashcards e Professor IA para você passar no concurso.",
    images: ["/opengraph-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#03050a" },
    { media: "(prefers-color-scheme: dark)", color: "#03050a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${manrope.className} bg-[#03050a] text-slate-50`}>
        <div className="fixed inset-0 -z-10 bg-matrix-gradient" aria-hidden="true" />
        <div className="relative z-10">
          {children}
        </div>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
