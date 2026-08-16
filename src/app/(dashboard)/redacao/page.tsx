import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { EssayCorrectionForm } from "@/components/study/essay-correction-form";

export const metadata: Metadata = { title: "Correção de redação" };

export default async function RedacaoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Correção de redação</h1>
        <p className="text-sm text-muted-foreground">
          O Professor IA avalia sua redação dissertativa-argumentativa com critérios estilo ENEM
          (coerência, coesão, norma culta, argumentação e proposta de intervenção).
        </p>
      </div>
      <EssayCorrectionForm />
    </div>
  );
}
