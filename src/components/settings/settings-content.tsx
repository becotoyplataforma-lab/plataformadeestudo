"use client";

import * as React from "react";
import { toast } from "sonner";
import { CreditCard, FileLock2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  plano: "free" | "pro" | "intensivo";
  email?: string | null;
}

const PLAN_LABEL: Record<string, string> = {
  free: "Gratuito",
  pro: "Pro",
  intensivo: "Intensivo",
};

export function SettingsContent({ plano, email }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [checkoutLoading, setCheckoutLoading] = React.useState<"pro" | "intensivo" | null>(null);

  /** Inicia o checkout no Mercado Pago para o plano escolhido */
  async function startCheckout(plan: "pro" | "intensivo") {
    setCheckoutLoading(plan);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao gerar checkout.");
        return;
      }
      // Redireciona para o checkout do Mercado Pago
      if (data.init_point) {
        window.location.href = data.init_point;
      }
    } catch {
      toast.error("Erro de conexão ao gerar o checkout.");
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function onSendReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recuperar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSent(true);
        toast.success("E-mail de redefinição enviado.");
      } else {
        toast.error("Não foi possível enviar.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Plano */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-blue-600" /> Plano atual
          </CardTitle>
          <CardDescription>
            Gerencie sua assinatura e benefícios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-semibold">{PLAN_LABEL[plano]}</p>
              <p className="text-sm text-muted-foreground">
                {plano === "free"
                  ? "20 questões/dia · 50 mensagens IA"
                  : plano === "pro"
                    ? "Questões ilimitadas · IA Flash + Pro"
                    : "Tudo do Pro + Knowledge Engine"}
              </p>
            </div>
            {plano !== "free" && <Badge variant="success">Ativo</Badge>}
          </div>

          {/* Upgrade (apenas para plano gratuito) */}
          {plano === "free" && (
            <div className="rounded-lg border p-4">
              <p className="mb-3 text-sm font-medium">Escolha seu plano (pagamento via Mercado Pago):</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => startCheckout("pro")}
                  disabled={checkoutLoading !== null}
                  className="flex items-center justify-between rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4 text-left transition-colors hover:border-blue-400 dark:bg-blue-950/20"
                >
                  <div>
                    <p className="font-semibold">Pro</p>
                    <p className="text-xs text-muted-foreground">R$ 29,90/mês · questões ilimitadas + IA Pro</p>
                  </div>
                  <Sparkles className="h-5 w-5 text-blue-600" />
                </button>
                <button
                  type="button"
                  onClick={() => startCheckout("intensivo")}
                  disabled={checkoutLoading !== null}
                  className="flex items-center justify-between rounded-lg border-2 border-violet-200 bg-violet-50/50 p-4 text-left transition-colors hover:border-violet-400 dark:bg-violet-950/20"
                >
                  <div>
                    <p className="font-semibold">Intensivo</p>
                    <p className="text-xs text-muted-foreground">R$ 49,90/mês · tudo do Pro + Knowledge Engine</p>
                  </div>
                  <Sparkles className="h-5 w-5 text-violet-600" />
                </button>
              </div>
              {checkoutLoading && (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Redirecionando para o Mercado Pago...
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Pague com cartão, Pix ou boleto. Após a confirmação, seu plano é ativado
                automaticamente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Segurança */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Segurança
          </CardTitle>
          <CardDescription>
            Proteja o acesso à sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSendReset} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="reset-email">E-mail cadastrado</Label>
              <Input id="reset-email" defaultValue={email ?? ""} disabled />
            </div>
            {sent ? (
              <p className="text-sm text-emerald-600">
                📬 Link de redefinição enviado para seu e-mail.
              </p>
            ) : (
              <Button type="submit" variant="outline" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileLock2 className="h-4 w-4" />
                )}
                Redefinir senha
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Recursos futuros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recursos em breve</CardTitle>
          <CardDescription>
            Estamos construindo para turbinar seus estudos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>📄 <strong>Knowledge Engine</strong> — importe PDFs, apostilas e editais.</li>
            <li>🎯 <strong>Contest Intelligence</strong> — análise de bancas e editais.</li>
            <li>🔁 <strong>Revisão espaçada avançada</strong> — algoritmo FSRS.</li>
            <li>🤖 <strong>Correção de redação</strong> — com o Professor IA.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
