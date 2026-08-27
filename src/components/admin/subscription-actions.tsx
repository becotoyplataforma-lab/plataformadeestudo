"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Ban, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubscriptionStatus } from "@/lib/billing/types";

interface SubscriptionRow {
  id: string;
  status: SubscriptionStatus;
  userEmail: string | null;
  planName: string;
}

/**
 * Ações de assinatura (cancelar / suspender / reativar).
 * Chama os endpoints /api/admin/financeiro/assinaturas/[id]/...
 */
export function SubscriptionActions({ row }: { row: SubscriptionRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"cancel" | "suspend" | "reactivate" | null>(null);

  async function run(action: "cancel" | "suspend" | "reactivate") {
    setBusy(action);
    try {
      const res = await fetch(
        `/api/admin/financeiro/assinaturas/${row.id}/${action}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message ?? data?.error ?? "Falha na operação.");
        return;
      }
      toast.success(
        action === "cancel"
          ? "Assinatura cancelada."
          : action === "suspend"
            ? "Assinatura suspensa."
            : "Assinatura reativada."
      );
      router.refresh();
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setBusy(null);
    }
  }

  const isActive = row.status === "active" || row.status === "past_due";

  return (
    <div className="flex items-center gap-1.5">
      {isActive && (
        <>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => run("suspend")}
            className="text-amber-300 hover:text-amber-200"
            title="Suspender"
          >
            {busy === "suspend" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Ban className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => run("cancel")}
            className="text-rose-300 hover:text-rose-200"
            title="Cancelar"
          >
            {busy === "cancel" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
          </Button>
        </>
      )}
      {(row.status === "suspended" || row.status === "cancelled") && (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy !== null}
          onClick={() => run("reactivate")}
          className="text-emerald-300 hover:text-emerald-200"
          title="Reativar"
        >
          {busy === "reactivate" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}
