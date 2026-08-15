/**
 * ConcursoAI — AdminDashboardRepository
 *
 * Contagens reais para o dashboard administrativo.
 */
import { count, eq, isNull, or, and } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { authUsers } from "@/db/schema/identity";
import { contests, editais } from "@/db/schema/contest";
import { documents } from "@/db/schema/knowledge";
import { questions, lessons } from "@/db/schema/study";
import { aiUsage, avatars } from "@/db/schema/ai";

export const AdminDashboardRepository = {
  async stats() {
    const [users, contestRows, editalRows, docRows, docFailRows, qRows, pendingRows, lessonRows, avatarRows, aiRows] =
      await Promise.all([
        db.select({ n: count() }).from(authUsers),
        db.select({ n: count() }).from(contests).where(isNull(contests.deletedAt)),
        db.select({ n: count() }).from(editais).where(isNull(editais.deletedAt)),
        db.select({ n: count() }).from(documents).where(isNull(documents.deletedAt)),
        db.select({ n: count() }).from(documents).where(eq(documents.status, "failed")),
        db.select({ n: count() }).from(questions).where(isNull(questions.deletedAt)),
        db
          .select({ n: count() })
          .from(questions)
          .where(
            and(
              or(eq(questions.status, "em_revisao"), eq(questions.needsReview, true)),
              isNull(questions.deletedAt)
            )
          ),
        db.select({ n: count() }).from(lessons).where(isNull(lessons.deletedAt)),
        db.select({ n: count() }).from(avatars).where(isNull(avatars.deletedAt)),
        db.select({ n: count() }).from(aiUsage),
      ]);

    return {
      totalUsers: Number(users[0]?.n ?? 0),
      totalContests: Number(contestRows[0]?.n ?? 0),
      totalEditais: Number(editalRows[0]?.n ?? 0),
      totalDocuments: Number(docRows[0]?.n ?? 0),
      documentsFailed: Number(docFailRows[0]?.n ?? 0),
      totalQuestions: Number(qRows[0]?.n ?? 0),
      pendingReviews: Number(pendingRows[0]?.n ?? 0),
      totalLessons: Number(lessonRows[0]?.n ?? 0),
      totalAvatars: Number(avatarRows[0]?.n ?? 0),
      aiMessagesTotal: Number(aiRows[0]?.n ?? 0),
    };
  },
};
