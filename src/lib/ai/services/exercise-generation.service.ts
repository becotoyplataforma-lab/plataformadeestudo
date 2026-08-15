/**
 * ConcursoAI — ExerciseGenerationService
 *
 * Gera exercícios personalizados: apostila + erros do aluno + tópico fraco.
 * Orquestra WeaknessAnalysisService → QuestionGenerationService.
 */
import "server-only";
import { WeaknessAnalysisService } from "@/lib/study/services/weakness-analysis.service";
import { QuestionGenerationService } from "./question-generation.service";

export const ExerciseGenerationService = {
  /**
   * Gera exercícios de reforço para a fraqueza mais relevante do aluno
   * dentro de uma matéria/documento.
   */
  async generateForWeakness(input: {
    adminUserId: string;
    userId: string;
    documentId: string;
    subjectId: string;
    quantity: number;
    nivel?: "facil" | "medio" | "dificil";
  }): Promise<{
    weakness: { subjectName: string; accuracy: number; topic?: string } | null;
    generation: Awaited<
      ReturnType<typeof QuestionGenerationService.generateFromDocument>
    >;
  }> {
    const weaknesses = await WeaknessAnalysisService.analyze(input.userId, {
      minAttempts: 1,
      maxAccuracy: 1,
    });
    const weak = weaknesses.find((w) => w.subjectId === input.subjectId) ?? null;
    const focusTopic = weak?.topics?.[0]?.topic;

    const generation = await QuestionGenerationService.generateFromDocument({
      adminUserId: input.adminUserId,
      documentId: input.documentId,
      subjectId: input.subjectId,
      quantity: input.quantity,
      nivel: input.nivel ?? "facil",
      focusTopic,
    });

    return {
      weakness: weak
        ? {
            subjectName: weak.subjectName,
            accuracy: weak.accuracy,
            topic: focusTopic,
          }
        : null,
      generation,
    };
  },
};
