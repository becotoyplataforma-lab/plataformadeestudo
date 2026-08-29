import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { AdminGuardService } from "@/lib/administration/services/admin-guard.service";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { ProfessorUploadForm } from "@/components/apostilas/professor-upload-form";

export const metadata: Metadata = {
  title: "Minhas Apostilas — Professor",
  description: "Envie e transforme apostilas no layout em fases com a marca DeepSeek.",
};

/**
 * Área do PROFESSOR — upload de apostilas com transformação em fases.
 * Acessível a professores (allowlist PROFESSOR_EMAILS) e admins.
 * Não é a área /admin: o professor vê apenas suas próprias apostilas.
 */
export default async function ProfessorApostilasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const isProfessor = await AdminGuardService.isProfessorOrAdmin(session.user.email).catch(
    () => false
  );
  if (!isProfessor) {
    redirect("/dashboard");
  }

  const docs = await DocumentRepository.listByUser(session.user.id, 100);

  const transformedCount = docs.filter(
    (d) =>
      typeof (d.metadata ?? {}) === "object" &&
      typeof ((d.metadata as Record<string, unknown>) ?? {}).transformed_html_path ===
        "string"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Minhas Apostilas</h1>
        <p className="text-sm text-slate-400">
          Envie apostilas e transforme-as no layout em fases com a marca DeepSeek (baleia).
        </p>
      </div>

      <ProfessorUploadForm />

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-medium text-slate-200">
          Apostilas enviadas ({docs.length}) · {transformedCount} transformadas com IA
        </p>
        <div className="mt-3 space-y-2">
          {docs.length === 0 && (
            <p className="text-sm text-slate-500">Nenhuma apostila enviada ainda.</p>
          )}
          {docs.map((d) => {
            const meta = (d.metadata ?? {}) as Record<string, unknown>;
            const transformed = typeof meta.transformed_html_path === "string";
            return (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <div>
                  <Link
                    href={`/apostilas/${d.id}`}
                    className="text-sm font-semibold text-slate-200 hover:text-cyan-300"
                  >
                    {d.title}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {d.type} · status {d.status}
                    {transformed && (
                      <span className="ml-2 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] uppercase text-cyan-300">
                        Transformada em fases
                      </span>
                    )}
                  </p>
                </div>
                <Link
                  href={`/apostilas/${d.id}`}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-cyan-300 hover:bg-white/10"
                >
                  Ver apostila
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
