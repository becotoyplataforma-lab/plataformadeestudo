import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Definir nova senha",
  description: "Conclua a redefininicao de senha da sua conta ConcursoAI.",
  // O link de recuperacao chega aqui com tokens no fragmento da URL: a pagina nao
  // pode ser indexada nem seguida por buscadores.
  robots: { index: false, follow: false },
  alternates: { canonical: "/redefinir-senha" },
};

export default function ResetPasswordPage() {
  return (
    <Card className="border-0 shadow-xl sm:border">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Definir nova senha</CardTitle>
        <CardDescription>
          Escolha a senha que sera usada a partir de agora. O link que abriu esta
          pagina vale para uma unica redefinicao.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Nao foi esse link que voce pediu?{" "}
          <Link href="/recuperar-senha" className="font-medium text-blue-600 hover:underline">
            Solicitar novo link
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
