import { AvatarRepository } from "@/lib/ai/repositories/avatar.repository";
import { AvatarCreateForm } from "@/components/admin/avatar-create-form";

export const dynamic = "force-dynamic";

export default async function AdminAvataresPage() {
  const avatars = await AvatarRepository.listAll();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Avatares</h2>
        <p className="text-sm text-slate-400">
          Professores virtuais — personagens ORIGINAIS do ConcursoAI (sem copyright).
        </p>
      </div>

      <AvatarCreateForm />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {avatars.map((a) => (
          <div key={a.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">{a.nome}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  a.ativo ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-slate-400"
                }`}
              >
                {a.ativo ? "ativo" : "inativo"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">{a.descricao}</p>
            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <p>Personalidade: {a.personalidade ?? "—"}</p>
              <p>Aparência: {a.aparencia ?? "—"}</p>
              <p>Voz: {a.voz ?? "—"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
