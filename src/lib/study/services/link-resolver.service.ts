/**
 * ConcursoAI — LinkResolverService
 *
 * Vincula study_subjects (disciplinas do aluno) a knowledge_subjects (catálogo)
 * sem FK no banco — usando match por nome/slug.
 *
 * Zero-migration: não altera schema.
 */
import "server-only";
import { KnowledgeSubjectRepository } from "@/lib/knowledge/repositories/subject.repository";
import type { knowledgeSubjects } from "@/db/schema/knowledge";

// ============================================================
// Tipos
// ============================================================

export type KnowledgeSubjectRow = typeof knowledgeSubjects.$inferSelect;

export interface LinkResult {
  /** knowledge_subject encontrado ou null */
  knowledgeSubject: KnowledgeSubjectRow | null;
  /** Método que resolveu: "exact" | "slug" | "none" */
  method: "exact" | "slug" | "none";
}

// ============================================================
// Helpers
// ============================================================

/**
 * Gera slug simples (removendo acentos, pontuação, lowercase).
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ============================================================
// Service
// ============================================================

export const LinkResolverService = {
  /**
   * Tenta vincular uma disciplina do aluno ao catálogo de matérias.
   *
   * Estratégia:
   * 1. Match exato (case-insensitive) pelo nome
   * 2. Fallback: slugify ambos e compara
   */
  async resolve(subjectName: string): Promise<LinkResult> {
    const trimmed = subjectName.trim();
    if (!trimmed) return { knowledgeSubject: null, method: "none" };

    // Nível 1: match exato case-insensitive
    const exact = await KnowledgeSubjectRepository.findByName(trimmed);
    if (exact) {
      return { knowledgeSubject: exact, method: "exact" };
    }

    // Nível 2: slugify
    const subjectSlug = slugify(trimmed);
    const allSubjects = await KnowledgeSubjectRepository.getAll();

    for (const ks of allSubjects) {
      const ksSlug = slugify(ks.name);
      if (subjectSlug === ksSlug) {
        return { knowledgeSubject: ks, method: "slug" };
      }
    }

    return { knowledgeSubject: null, method: "none" };
  },

  /**
   * Resolve em lote — útil para recalcular prioridades de todas as disciplinas.
   */
  async resolveBatch(
    subjectNames: string[]
  ): Promise<Map<string, LinkResult>> {
    const results = new Map<string, LinkResult>();
    const allKnowledge = await KnowledgeSubjectRepository.getAll();

    for (const name of subjectNames) {
      const trimmed = name.trim();
      if (!trimmed) {
        results.set(name, { knowledgeSubject: null, method: "none" });
        continue;
      }

      // Nível 1: match exato
      const exact = allKnowledge.find(
        (ks) => ks.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (exact) {
        results.set(name, { knowledgeSubject: exact, method: "exact" });
        continue;
      }

      // Nível 2: slugify
      const subjectSlug = slugify(trimmed);
      const slugMatch = allKnowledge.find(
        (ks) => slugify(ks.name) === subjectSlug
      );
      if (slugMatch) {
        results.set(name, { knowledgeSubject: slugMatch, method: "slug" });
        continue;
      }

      results.set(name, { knowledgeSubject: null, method: "none" });
    }

    return results;
  },
};
