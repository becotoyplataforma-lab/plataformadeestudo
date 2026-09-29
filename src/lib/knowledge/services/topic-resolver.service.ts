/**
 * ConcursoAI — TopicResolverService
 *
 * Resolução determinística de assunto (questions.topic -> knowledge_topics.id).
 * Opera em cascata rigorosa antes de qualquer uso de IA:
 *   1. ID informado (se válido e pertencente à mesma disciplina);
 *   2. Correspondência exata normalizada (case, acento, espaços, pontuação);
 *   3. Correspondência por slug normalizado;
 *   4. Ambiguidade ou tópico de outra disciplina -> NULL (preserva texto original).
 */
import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { knowledgeTopics } from "@/db/schema/knowledge";

export interface TopicCandidate {
  id: string;
  subjectId: string;
  name: string;
  slug: string;
}

export type TopicResolveMethod = "id" | "exact" | "slug" | "none";

export interface TopicResolveResult {
  topicId: string | null;
  method: TopicResolveMethod;
  matchedTopic?: TopicCandidate;
}

/**
 * Normaliza string para comparação de tópicos:
 * - minúsculas
 * - remoção de acentos (NFD)
 * - remoção de pontuação simples
 * - colapso de espaços em branco múltiplos
 * - trim
 */
export function normalizeTopicName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?'"()[\]{}_/\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza string para formato de slug compatível:
 * - minúsculas
 * - sem acentos
 * - caracteres não-alfanuméricos substituídos por hífen único
 */
export function slugifyTopic(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Função pura em memória para resolução determinística de tópicos.
 * Utilizada tanto pelo serviço em runtime quanto por testes unitários.
 */
export function resolveTopicInMemory(
  input: {
    topicName?: string | null;
    topicId?: string | null;
    subjectId: string;
  },
  availableTopics: TopicCandidate[]
): TopicResolveResult {
  const { topicName, topicId, subjectId } = input;

  // 1. Tópicos disponíveis filtrados para a disciplina informada
  const subjectTopics = availableTopics.filter((t) => t.subjectId === subjectId);

  // 2. Se topicId foi informado explicitamente:
  if (topicId) {
    const directMatch = subjectTopics.find((t) => t.id === topicId);
    if (directMatch) {
      return { topicId: directMatch.id, method: "id", matchedTopic: directMatch };
    }
    // Se o topicId existir em outra disciplina, rejeita (não permite cross-subject)
    return { topicId: null, method: "none" };
  }

  // 3. Se não há nome textual informado, encerra seguro
  if (!topicName || topicName.trim().length === 0) {
    return { topicId: null, method: "none" };
  }

  const normTarget = normalizeTopicName(topicName);
  if (!normTarget) {
    return { topicId: null, method: "none" };
  }

  // 4. Correspondência exata normalizada (dentro da mesma disciplina)
  const exactMatches = subjectTopics.filter(
    (t) => normalizeTopicName(t.name) === normTarget
  );
  if (exactMatches.length === 1) {
    return {
      topicId: exactMatches[0]!.id,
      method: "exact",
      matchedTopic: exactMatches[0],
    };
  }
  // Se houver múltiplos matches com mesmo nome normalizado: ambíguo -> null
  if (exactMatches.length > 1) {
    return { topicId: null, method: "none" };
  }

  // 5. Correspondência por slug normalizado
  const slugTarget = slugifyTopic(topicName);
  if (slugTarget) {
    const slugMatches = subjectTopics.filter((t) => slugifyTopic(t.slug) === slugTarget);
    if (slugMatches.length === 1) {
      return {
        topicId: slugMatches[0]!.id,
        method: "slug",
        matchedTopic: slugMatches[0],
      };
    }
    // Múltiplos slugs colidindo: ambíguo -> null
    if (slugMatches.length > 1) {
      return { topicId: null, method: "none" };
    }
  }

  // 6. Sem correspondência inequívoca encontrada
  return { topicId: null, method: "none" };
}

export const TopicResolverService = {
  /**
   * Resolve um tópico contra o banco de dados para a disciplina indicada.
   */
  async resolveTopic(input: {
    topicName?: string | null;
    topicId?: string | null;
    subjectId: string;
  }): Promise<TopicResolveResult> {
    const { subjectId } = input;
    if (!subjectId) {
      return { topicId: null, method: "none" };
    }

    // Busca tópicos ativos da disciplina
    const rows = await db
      .select({
        id: knowledgeTopics.id,
        subjectId: knowledgeTopics.subjectId,
        name: knowledgeTopics.name,
        slug: knowledgeTopics.slug,
      })
      .from(knowledgeTopics)
      .where(
        and(
          eq(knowledgeTopics.subjectId, subjectId),
          eq(knowledgeTopics.status, "active"),
          isNull(knowledgeTopics.deletedAt)
        )
      );

    return resolveTopicInMemory(input, rows);
  },
};
