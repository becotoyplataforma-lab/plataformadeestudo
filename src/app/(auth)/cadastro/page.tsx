import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta gratuita na ConcursoAI.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/cadastro" },
};

export default function RegisterPage() {
  return (
    <Card className="border-0 shadow-xl sm:border">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Crie sua conta grátis 🚀</CardTitle>
        <CardDescription>
          Comece a estudar com método e inteligência artificial.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            Fazer login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
