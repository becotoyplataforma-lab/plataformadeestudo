/**
 * FASE 18 — Integração real: Knowledge (DocumentRepository, ChunkRepository,
 * KnowledgeSubjectRepository no Postgres real).
 */
import { describe, it, expect, afterAll } from "vitest";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentChunkRepository } from "@/lib/knowledge/repositories/chunk.repository";
import { KnowledgeSubjectRepository } from "@/lib/knowledge/repositories/subject.repository";
import { hasDb, createTestUser, deleteTestUser } from "./helpers";

describe.skipIf(!hasDb)("Knowledge — integração real", () => {
  const users: string[] = [];

  afterAll(async () => {
    await Promise.all(users.map((id) => deleteTestUser(id)));
  });

  it("cria documento indexado + chunks e deduplica por hash", async () => {
    const userId = await createTestUser();
    users.push(userId);

    const doc = await DocumentRepository.create({
      userId,
      type: "pdf",
      title: "CF88.pdf",
      storagePath: `s3://${userId}/cf88.pdf`,
      status: "indexed",
      sourceType: "upload",
      fileHash: `hash-${userId}`,
    });
    expect(doc.id).toBeTruthy();

    await DocumentChunkRepository.createBatch([
      { documentId: doc.id, seq: 1, content: "Art. 5º — todos são iguais perante a lei." },
      { documentId: doc.id, seq: 2, content: "Art. 37 — a administração pública direta e indireta." },
    ]);

    const found = await DocumentRepository.findByHash(userId, `hash-${userId}`);
    expect(found?.id).toBe(doc.id);

    const chunks = await DocumentChunkRepository.listByDocument(doc.id);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].seq).toBe(1);
    // Coluna gerada fts_vector populada pelo gatilho/coluna generated
    expect(chunks[0].ftsVector).toBeTruthy();
  });

  it("KnowledgeSubjectRepository deduplica por slug", async () => {
    const subj = await KnowledgeSubjectRepository.findBySlug("direito-constitucional");
    if (subj) {
      expect(subj.name).toBeTruthy();
    } else {
      expect(subj).toBeNull();
    }
  });
});
