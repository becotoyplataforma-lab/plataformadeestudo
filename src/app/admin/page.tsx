import Link from "next/link";
import { AdminDashboardRepository } from "@/lib/administration/repositories/admin-dashboard.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const stats = await AdminDashboardRepository.stats();

  const cards = [
    { label: "Alunos", value: stats.totalUsers, href: "/admin/alunos" },
    { label: "Concursos", value: stats.totalContests, href: "/admin/concursos" },
    { label: "Editais", value: stats.totalEditais, href: "/admin/concursos" },
    { label: "Apostilas", value: stats.totalDocuments, href: "/admin/apostilas" },
    { label: "Apostilas com erro", value: stats.documentsFailed, href: "/admin/apostilas", alert: stats.documentsFailed > 0 },
    { label: "Questões", value: stats.totalQuestions, href: "/admin/questoes" },
    { label: "Aguardando revisão", value: stats.pendingReviews, href: "/admin/questoes/revisao", alert: stats.pendingReviews > 0 },
    { label: "Aulas", value: stats.totalLessons, href: "/admin/aulas" },
    { label: "Avatares", value: stats.totalAvatars, href: "/admin/avatares" },
    { label: "Mensagens IA", value: stats.aiMessagesTotal, href: "/admin/ia" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Visão geral</h2>
        <p className="text-sm text-slate-400">Números reais do sistema.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="border-white/10 bg-white/5 transition-transform hover:-translate-y-0.5">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-400">{c.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${c.alert ? "text-amber-300" : "text-white"}`}>
                  {c.value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-200">
        Alertas: {stats.documentsFailed} apostila(s) com erro · {stats.pendingReviews} questão(ões)
        aguardando revisão · IA e embeddings dependem das variáveis de ambiente
        (DEEPSEEK_API_KEY / EMBEDDING_API_URL).
      </div>
    </div>
  );
}
