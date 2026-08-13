/**
 * Testes do LinkResolverService — vínculo study_subjects ↔ knowledge_subjects.
 *
 * Estratégia: match exato (case-insensitive) → fallback por slug → none.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindByName = vi.fn();
const mockGetAll = vi.fn();

vi.mock("@/lib/knowledge/repositories/subject.repository", () => ({
  KnowledgeSubjectRepository: {
    findByName: (...a: unknown[]) => mockFindByName(...a),
    getAll: (...a: unknown[]) => mockGetAll(...a),
  },
}));

import { LinkResolverService } from "../link-resolver.service";

const KS_PORTUGUES = {
  id: "ks-1",
  name: "Português",
  slug: "portugues",
  description: null,
  color: "#0ea5e9",
  keywords: [],
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  deletedAt: null,
};

describe("LinkResolverService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("resolve", () => {
    it("retorna match exato quando o nome coincide", async () => {
      mockFindByName.mockResolvedValue(KS_PORTUGUES);

      const result = await LinkResolverService.resolve("Português");

      expect(result.method).toBe("exact");
      expect(result.knowledgeSubject?.id).toBe("ks-1");
      expect(mockFindByName).toHaveBeenCalledWith("Português");
      expect(mockGetAll).not.toHaveBeenCalled();
    });

    it("faz fallback por slug quando não há match exato", async () => {
      mockFindByName.mockResolvedValue(null);
      mockGetAll.mockResolvedValue([KS_PORTUGUES]);

      // "Portugues" sem acento não bate no nome exato, mas o slug coincide
      const result = await LinkResolverService.resolve("Portugues");

      expect(result.method).toBe("slug");
      expect(result.knowledgeSubject?.id).toBe("ks-1");
      expect(mockFindByName).toHaveBeenCalledWith("Portugues");
    });

    it("retorna none para matéria desconhecida", async () => {
      mockFindByName.mockResolvedValue(null);
      mockGetAll.mockResolvedValue([KS_PORTUGUES]);

      const result = await LinkResolverService.resolve("Matéria Inexistente");

      expect(result.method).toBe("none");
      expect(result.knowledgeSubject).toBeNull();
    });

    it("retorna none para nome vazio sem consultar o banco", async () => {
      const result = await LinkResolverService.resolve("   ");

      expect(result.method).toBe("none");
      expect(result.knowledgeSubject).toBeNull();
      expect(mockFindByName).not.toHaveBeenCalled();
    });
  });

  describe("resolveBatch", () => {
    it("resolve múltiplas matérias de uma vez", async () => {
      mockGetAll.mockResolvedValue([KS_PORTUGUES]);

      const map = await LinkResolverService.resolveBatch([
        "português",
        "Matéria Desconhecida",
      ]);

      expect(map.get("português")?.method).toBe("exact");
      expect(map.get("português")?.knowledgeSubject?.id).toBe("ks-1");
      expect(map.get("Matéria Desconhecida")?.method).toBe("none");
      expect(map.get("Matéria Desconhecida")?.knowledgeSubject).toBeNull();
    });

    it("lida com nomes vazios dentro do lote", async () => {
      mockGetAll.mockResolvedValue([KS_PORTUGUES]);

      const map = await LinkResolverService.resolveBatch(["", "Português"]);

      expect(map.get("")?.method).toBe("none");
      expect(map.get("Português")?.method).toBe("exact");
    });
  });
});
