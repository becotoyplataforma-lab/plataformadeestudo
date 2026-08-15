/**
 * GET /api/study/edital-subjects
 *
 * Matérias do edital vigente do concurso/cargo do aluno (com pesos).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getProfile } from "@/lib/db/repositories/perfil";
import { listEditalSubjectsForStudent } from "@/lib/db/repositories/edital";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const profile = await getProfile(session.user.id);
    if (!profile?.contest_id) {
      return NextResponse.json({
        data: [],
        message: "Defina seu concurso/cargo no perfil para ver as matérias do edital.",
      });
    }

    const subjects = await listEditalSubjectsForStudent(
      profile.contest_id,
      profile.position_id ?? null
    );
    return NextResponse.json({ data: subjects });
  } catch (error) {
    console.error("[study/edital-subjects] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
