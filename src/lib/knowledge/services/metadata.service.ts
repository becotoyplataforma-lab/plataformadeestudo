/**
 * ConcursoAI — MetadataService
 *
 * Extrai, infere e enriquece metadados de documentos:
 * classificação (subject/topic), tags, referências legais, idioma.
 *
 * Segue: .ai/blueprints/02-metadata.blueprint.md
 */
import { DocumentRepository } from "../repositories/document.repository";
import { KnowledgeSubjectRepository } from "../repositories/subject.repository";
import { KnowledgeTopicRepository } from "../repositories/topic.repository";
import { KnowledgeTagRepository } from "../repositories/tag.repository";
import {
  DocumentSubjectRepository,
  DocumentTopicRepository,
  DocumentTagRepository,
} from "../repositories/junction.repository";
import {
  detectLanguage,
  extractKeywords,
  extractLegalReferences,
  type LegalReference,
} from "./metadata.helpers";

// ============================================================
// Tipos
// ============================================================

export interface MetadataInput {
  documentId: string;
  text: string;
  fileMetadata?: { filename?: string; size?: number; modifiedAt?: Date };
}

export interface MetadataOutput {
  documentId: string;
  metadata: Record<string, unknown>;
  subject: { id: string; name: string; confidence: number } | null;
  topics: { id: string; name: string; confidence: number }[];
  tags: string[];
  legalReferences: LegalReference[];
  language: string;
}

// ============================================================
// Service
// ============================================================

export const MetadataService = {
  /**
   * Orquestrar extração completa de metadados.
   */
  async extract(input: MetadataInput): Promise<MetadataOutput> {
    const { documentId, text, fileMetadata } = input;

    // 1. Detectar idioma
    const language = detectLanguage(text);

    // 2. Classificar matéria (keyword matching)
    const subject = await classifySubject(text);

    // 3. Classificar tópicos
    const topics = subject
      ? await classifyTopics(text, subject.id)
      : [];

    // 4. Sugerir tags
    const keywords = extractKeywords(text);
    const tags: string[] = [];
    for (const kw of keywords) {
      const tag = await KnowledgeTagRepository.findOrCreate(kw);
      tags.push(tag.name);
    }

    // 5. Extrair referências legais
    const legalReferences = extractLegalReferences(text);

    // 6. Construir metadados
    const metadata: Record<string, unknown> = {
      language,
      extracted_at: new Date().toISOString(),
      ...(fileMetadata?.filename && { original_filename: fileMetadata.filename }),
      ...(fileMetadata?.size && { original_size: fileMetadata.size }),
    };

    if (subject) {
      metadata.subject = { id: subject.id, name: subject.name, confidence: subject.confidence };
    }

    if (topics.length > 0) {
      metadata.topics = topics.map((t) => ({ id: t.id, name: t.name, confidence: t.confidence }));
    }

    if (tags.length > 0) {
      metadata.tags = tags;
    }

    if (legalReferences.length > 0) {
      metadata.legal_references = legalReferences;
    }

    // 7. Persistir
    await DocumentRepository.updateMetadata(documentId, metadata);

    // 8. Criar junctions
    if (subject) {
      await DocumentSubjectRepository.upsert(documentId, subject.id, subject.confidence);
    }

    for (const topic of topics) {
      await DocumentTopicRepository.upsert(documentId, topic.id, topic.confidence);
    }

    for (const tagName of tags) {
      const tag = await KnowledgeTagRepository.findOrCreate(tagName);
      await DocumentTagRepository.upsert(documentId, tag.id);
    }

    return {
      documentId,
      metadata,
      subject: subject ? { id: subject.id, name: subject.name, confidence: subject.confidence } : null,
      topics: topics.map((t) => ({ id: t.id, name: t.name, confidence: t.confidence })),
      tags,
      legalReferences,
      language,
    };
  },
};

// ============================================================
// Classificadores
// ============================================================

interface ClassificationResult {
  id: string;
  name: string;
  confidence: number;
}

async function classifySubject(text: string): Promise<ClassificationResult | null> {
  const subjects = await KnowledgeSubjectRepository.getAll();
  const lower = text.toLowerCase();
  let best: ClassificationResult | null = null;
  let bestScore = 0;

  for (const subject of subjects) {
    const keywords = (subject.keywords as string[]) ?? [];
    if (keywords.length === 0) continue;

    let score = 0;
    for (const kw of keywords) {
      const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const matches = lower.match(regex);
      if (matches) score += matches.length;
    }

    const normalizedScore = score / (keywords.length * Math.max(1, text.length / 1000));

    if (normalizedScore > bestScore) {
      bestScore = normalizedScore;
      best = { id: subject.id, name: subject.name, confidence: Math.min(100, Math.round(normalizedScore * 100)) };
    }
  }

  return best && best.confidence > 10 ? best : null;
}

async function classifyTopics(
  text: string,
  subjectId: string
): Promise<ClassificationResult[]> {
  const allTopics = await KnowledgeTopicRepository.getAllBySubject(subjectId);
  const lower = text.toLowerCase();
  const results: ClassificationResult[] = [];

  for (const topic of allTopics) {
    const terms = [topic.name, topic.slug.replace(/-/g, " ")];
    let score = 0;

    for (const term of terms) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const matches = lower.match(regex);
      if (matches) score += matches.length * 3;
    }

    const normalizedScore = score / Math.max(1, text.length / 1000);

    if (normalizedScore > 0.2) {
      results.push({
        id: topic.id,
        name: topic.name,
        confidence: Math.min(100, Math.round(normalizedScore * 100)),
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}
