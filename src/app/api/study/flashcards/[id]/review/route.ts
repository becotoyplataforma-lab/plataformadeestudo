/**
 * POST /api/study/flashcards/[id]/review — registra revisão SRS (SM-2)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import {
  ReviewScheduleService,
  ReviewScheduleError,
} from "@/lib/study/services/review-schedule.service";
import { ReviewRequestDtoSchema, mapScheduleToDto } from "@/lib/dto/study.dto";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { id } = await context.params;
    const body = await request.json();
    const parsed = ReviewRequestDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const result = await ReviewScheduleService.review(session.user.id, id, parsed.data.rating);
    return NextResponse.json({
      schedule_id: result.scheduleId,
      interval_days: result.intervalDays,
      ease_factor: result.easeFactor,
      repetitions: result.repetitions,
      due_date: result.dueDate.toISOString(),
    });
  } catch (error) {
    if (error instanceof ReviewScheduleError) {
      const status = error.code === "FLASHCARD_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[study/flashcards] review:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
