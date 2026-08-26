"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminList {
  admins: string[];
  superadmins: string[];
}

export function AdminManagementClient({
  initial,
  currentEmail,
}: {
  initial: AdminList;
  currentEmail: string | null;
}) {
  const router = useRouter();
  const [admins, setAdmins] = useState<string[]>(initial.admins);
  const [superadmins, setSuperadmins] = useState<string[]>(initial.superadmins);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "superadmin">("admin");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha ao adicionar.");
        return;
      }
      setMsg(
        role === "superadmin"
          ? `"${email.trim()}" adicionado como superadmin.`
          : `"${email.trim()}" adicionado como admin.`
      );
      setEmail("");
      if (role === "superadmin") setSuperadmins(data.list);
      else setAdmins(data.list);
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(target: string, targetRole: "admin" | "superadmin") {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target, role: targetRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Falha ao remover.");
        return;
      }
      setMsg(`"${target}" removido.`);
      if (targetRole === "superadmin") setSuperadmins(data.list);
      else setAdmins(data.list);
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-sm text-slate-200">
            Adicionar administrador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-3">
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-900 text-slate-200"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "superadmin")}
              className="h-9 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-slate-200"
            >
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
            <Button type="submit" disabled={busy || !email.trim()}>
              {busy ? "Salvando..." : "Adicionar"}
            </Button>
            {msg && <p className="text-sm text-emerald-300 sm:col-span-3">{msg}</p>}
            {error && <p className="text-sm text-rose-300 sm:col-span-3">{error}</p>}
          </form>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-sm text-slate-200">
            Superadministradores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {superadmins.length === 0 ? (
            <p className="text-sm text-slate-400">
              Nenhum superadmin configurado em system_settings.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {superadmins.map((email) => (
                <li
                  key={email}
                  className="flex items-center justify-between py-2"
                >
                  <span className="text-sm text-slate-200">{email}</span>
                  <div className="flex items-center gap-2">
                    {email === currentEmail && (
                      <span className="text-xs text-cyan-300">você</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy || email === currentEmail}
                      onClick={() => remove(email, "superadmin")}
                      className="text-rose-300 hover:text-rose-200"
                    >
                      Remover
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-sm text-slate-200">
            Administradores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <p className="text-sm text-slate-400">
              Nenhum admin configurado em system_settings.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {admins.map((email) => (
                <li
                  key={email}
                  className="flex items-center justify-between py-2"
                >
                  <span className="text-sm text-slate-200">{email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => remove(email, "admin")}
                    className="text-rose-300 hover:text-rose-200"
                  >
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
