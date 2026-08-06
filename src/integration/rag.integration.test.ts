/**
 * FASE 18 — Integração real: RAG Engine.
 *
 * HybridSearchService e RagService reais contra o Postgres real (documento +
 * chunk indexados). Única fronteira externa mockada: HTTP DeepSeek (sem chave
 * real em ambiente de teste).
 */
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";

const mockChatCompletion = vi.fn();
vi.mock("@/lib/ai/deepseek", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/deepseek")>();
  return {
    ...actual,
    chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
  };
});

import { RagService } from "@/lib/ai/services/rag.service";
import { HybridSearchService } from "@/lib/knowledge/services/hybrid-search.service";
import { PromptService } from "@/lib/ai/services/prompt.service";
import { DeepSeekProvider } from "@/lib/ai/services/deepseek-provider.service";
import { ModelRouterService } from "@/lib/ai/services/model-router.service";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentChunkRepository } from "@/lib/knowledge/repositories/chunk.repository";
import { hasDb, createTestUser, deleteTestUser } from "./helpers";

describe.skipIf(!hasDb)("RAG — integração real", () => {
  const users: string[] = [];
  let userId: string;
  let docId: string;

  beforeAll(async () => {
    if (!hasDb) return;
    userId = await createTestUser();
    users.push(userId);
    const doc = await DocumentRepository.create({
      userId,
      type: "pdf",
      title: "CF88.pdf",
      storagePath: `s3://${userId}/cf88.pdf`,
      status: "indexed",
      sourceType: "upload",
      fileHash: `rag-${userId}`,
    });
    docId = doc.id;
    await DocumentChunkRepository.createBatch([
      { documentId: docId, seq: 1, content: "Art. 5º da Constituição — todos são iguais perante a lei, sem distinção de qualquer natureza." },
      { documentId: docId, seq: 2, content: "Art. 37 — a administração pública obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência." },
    ]);
    mockChatCompletion.mockResolvedValue({
      content: "Resposta fundamentada no art. 5º.",
      model: "flash",
      tokensIn: 50,
      tokensOut: 10,
    });
  });

  afterAll(async () => {
    await Promise.all(users.map((id) => deleteTestUser(id)));
  });

  it("HybridSearchService encontra chunks do documento via FTS", async () => {
    const out = await HybridSearchService.search({ query: "administração pública", userId });
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.results[0].documentId).toBe(docId);
  });

  it("RagService responde com citação do documento real", async () => {
    const rag = new RagService({
      search: HybridSearchService,
      prompt: PromptService,
      provider: DeepSeekProvider,
      router: ModelRouterService,
    });
    const out = await rag.answer({ question: "O que diz sobre a administração pública?", userId });
    expect(out.answer).toBe("Resposta fundamentada no art. 5º.");
    expect(out.citations.length).toBeGreaterThan(0);
    expect(out.citations[0].documentId).toBe(docId);
    expect(out.documents).toContain(docId);
    expect(out.searchTimeMs).toBeGreaterThanOrEqual(0);
  });
});
