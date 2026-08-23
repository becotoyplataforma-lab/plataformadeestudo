import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta na ConcursoAI.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/login" },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = sp.callbackUrl ?? "/dashboard";

  return (
    <Card className="border-0 shadow-xl sm:border">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Bem-vindo(a) de volta 👋</CardTitle>
        <CardDescription>
          Entre para continuar seus estudos com a IA.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm callbackUrl={callbackUrl} />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-blue-600 hover:underline">
            Cadastre-se grátis
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
