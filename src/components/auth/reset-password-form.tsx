"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  evaluateRecoveryLink,
  parseRecoveryHash,
  validateRecoveryPassword,
  type RecoveryLinkParams,
} from "@/lib/auth/recovery-link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Estados dirigidos por evento. O veredito do link nao e um deles: o fragmento da URL e
 * uma store externa do navegador, entao o veredito e derivado dela a cada render.
 */
type SubmitState = "idle" | "submitting" | "done" | "failed" | "rejected";

/** Mensagens fixas: a string crua do provedor pode trazer endereco ou token. */
const INVALID_HINT = "O link de recuperacao e invalido ou expirou. Solicite um novo.";
const FAILED_HINT = "Nao foi possivel definir a senha agora. Solicite um novo link.";

/**
 * Leitura do fragmento como store externa, no mesmo formato de src/hooks/use-mobile.ts.
 * null significa "fragmento ainda indisponivel": e o caso do servidor e do primeiro
 * render da hidratacao, que mostra "Verificando o link..." em vez de acusar link invalido.
 */
function subscribeRecoveryHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function getRecoveryHashSnapshot(): string | null {
  return window.location.hash;
}

function getRecoveryHashServerSnapshot(): string | null {
  return null;
}

export function ResetPasswordForm() {
  const hash = React.useSyncExternalStore<string | null>(
    subscribeRecoveryHash,
    getRecoveryHashSnapshot,
    getRecoveryHashServerSnapshot,
  );
  const [submit, setSubmit] = React.useState<SubmitState>("idle");
  const [error, setError] = React.useState<string | null>(null);

  const link: RecoveryLinkParams | null = React.useMemo(
    () => (hash === null ? null : parseRecoveryHash(hash)),
    [hash],
  );
  const verdict = React.useMemo(() => (link === null ? null : evaluateRecoveryLink(link)), [link]);

  // Do primeiro envio em diante o veredito para de ser reavaliado: o Supabase consome e
  // limpa o fragmento ao abrir a sessao de recovery, e isso nao pode virar "link invalido"
  // na tela de sucesso.
  const started = submit !== "idle";
  const linkInvalid = submit === "rejected" || (!started && verdict !== null && !verdict.valid);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!link?.accessToken || !link.refreshToken) {
      setSubmit("rejected");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (password !== confirm) {
      setError("As senhas nao coincidem.");
      return;
    }

    const check = validateRecoveryPassword(password);
    if (!check.ok) {
      setError(check.message ?? "Senha invalida.");
      return;
    }

    setError(null);
    setSubmit("submitting");

    // A troca acontece na sessao de recovery aberta a partir do link: o Supabase
    // Auth valida o token no servidor. Nada de token, e-mail ou senha vai para log.
    const supabase = createSupabaseBrowserClient();
    const restored = await supabase.auth.setSession({
      access_token: link.accessToken,
      refresh_token: link.refreshToken,
    });
    if (restored.error) {
      setSubmit("failed");
      return;
    }

    const updated = await supabase.auth.updateUser({ password });
    if (updated.error) {
      setSubmit("failed");
      return;
    }

    // A sessao de recuperacao nao vira sessao de uso: volta para o login.
    await supabase.auth.signOut();
    setSubmit("done");
  }

  if (hash === null) {
    return <p className="text-sm text-muted-foreground">Verificando o link...</p>;
  }

  if (linkInvalid) {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {INVALID_HINT}
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/recuperar-senha">Solicitar novo link</Link>
        </Button>
      </div>
    );
  }

  if (submit === "done") {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mr-1 inline h-4 w-4" />
          Senha redefinida. Faca login para continuar.
        </p>
        <Button asChild className="w-full">
          <Link href="/login">Ir para o login</Link>
        </Button>
      </div>
    );
  }

  const busy = submit === "submitting";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required disabled={busy} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Repita a nova senha</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required disabled={busy} />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {submit === "failed" ? <p className="text-sm text-red-600">{FAILED_HINT}</p> : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Definir nova senha
      </Button>
    </form>
  );
}