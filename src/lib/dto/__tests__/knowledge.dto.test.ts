/**
 * Testes dos DTOs do Knowledge — validação Zod e mappers.
 */
import { describe, it, expect } from "vitest";
import {
  SearchRequestDtoSchema,
  DocumentDtoSchema,
  mapDocumentToDto,
} from "@/lib/dto/knowledge.dto";

describe("Knowledge DTOs", () => {
  describe("SearchRequestDtoSchema", () => {
    it("aceita query válida", () => {
      const result = SearchRequestDtoSchema.safeParse({ query: "direitos fundamentais" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.top_k).toBe(10); // default
    });

    it("rejeita query vazia", () => {
      const result = SearchRequestDtoSchema.safeParse({ query: "" });
      expect(result.success).toBe(false);
    });

    it("rejeita query muito longa (> 500 chars)", () => {
      const result = SearchRequestDtoSchema.safeParse({ query: "a".repeat(501) });
      expect(result.success).toBe(false);
    });

    it("rejeita top_k fora do intervalo", () => {
      const result = SearchRequestDtoSchema.safeParse({ query: "teste", top_k: 100 });
      expect(result.success).toBe(false);
    });

    it("aceita UUIDs de filtro", () => {
      const uuid = "00000000-0000-0000-0000-000000000001";
      const result = SearchRequestDtoSchema.safeParse({
        query: "teste",
        subject_id: uuid,
        document_id: uuid,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("DocumentDtoSchema", () => {
    it("rejeita status inválido", () => {
      const result = DocumentDtoSchema.safeParse({
        id: "00000000-0000-0000-0000-000000000001",
        user_id: "00000000-0000-0000-0000-000000000002",
        type: "pdf",
        title: "Doc",
        storage_path: "path",
        status: "invalid_status",
        file_size: 100,
        mime_type: "application/pdf",
        source_type: "upload",
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      expect(result.success).toBe(false);
    });

    it("rejeita file_size negativo", () => {
      const result = DocumentDtoSchema.safeParse({
        id: "00000000-0000-0000-0000-000000000001",
        user_id: "00000000-0000-0000-0000-000000000002",
        type: "pdf",
        title: "Doc",
        storage_path: "path",
        status: "pending",
        file_size: -5,
        mime_type: "application/pdf",
        source_type: "upload",
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("mapDocumentToDto", () => {
    it("mapeia row do banco para DTO", () => {
      const row = {
        id: "00000000-0000-0000-0000-000000000001",
        userId: "00000000-0000-0000-0000-000000000002",
        type: "pdf",
        title: "Edital",
        storagePath: "user/doc/file.pdf",
        status: "pending",
        fileSize: 100,
        mimeType: "application/pdf",
        sourceType: "upload",
        sourceUrl: null,
        externalId: null,
        metadata: { key: "value" },
        createdAt: new Date("2026-08-04T12:00:00Z"),
        updatedAt: new Date("2026-08-04T12:00:00Z"),
        deletedAt: null,
      } as unknown as Parameters<typeof mapDocumentToDto>[0];

      const dto = mapDocumentToDto(row);

      expect(dto.id).toBe(row.id);
      expect(dto.user_id).toBe(row.userId);
      expect(dto.storage_path).toBe(row.storagePath);
      expect(dto.status).toBe("pending");
      expect(dto.metadata).toEqual({ key: "value" });
    });
  });
});
