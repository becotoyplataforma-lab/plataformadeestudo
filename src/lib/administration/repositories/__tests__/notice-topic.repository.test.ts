/**
 * ConcursoAI — NoticeTopicRepository Test
 *
 * Testes unitários da lógica de persistência e hierarquia de notice_topics:
 * - ordenação topológica (pais inseridos antes dos filhos)
 * - deduplicação de tópicos equivalentes por normalizedName
 * - tratamento de ciclos ou referências órfãs
 * - preservação de metadados e pesos explícitos
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDelete = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();

const mockTx = {
  delete: mockDelete,
  insert: mockInsert,
};

vi.mock("@/lib/db/drizzle", () => ({
  db: {
    transaction: async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    select: () => mockSelect(),
  },
}));

import { NoticeTopicRepository } from "../notice-topic.repository";

describe("NoticeTopicRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna array vazio quando inputs for vazio ou nulo", async () => {
    mockDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const res = await NoticeTopicRepository.replaceTopicsForNoticeSubject("subject-1", []);
    expect(res).toEqual([]);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("deduplica em memória itens com mesmo normalizedName na mesma disciplina", async () => {
    mockDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const insertedRows: unknown[] = [];
    mockInsert.mockImplementation(() => ({
      values: (val: { name: string; normalizedName: string }) => ({
        returning: async () => {
          const row = { id: `id-${val.normalizedName}`, ...val };
          insertedRows.push(row);
          return [row];
        },
      }),
    }));

    const inputs = [
      { name: "Crase", weight: 5 },
      { name: "  CRÁSE  ", weight: 10 }, // duplicata
      { name: "crase.", weight: 15 },    // duplicata
      { name: "Ortografia", weight: null },
    ];

    const res = await NoticeTopicRepository.replaceTopicsForNoticeSubject("subject-1", inputs);
    expect(res).toHaveLength(2);
    expect(res.map((r) => r.name)).toEqual(["Crase", "Ortografia"]);
  });

  it("insere pais antes dos filhos e resolve parentNoticeTopicId corretamente", async () => {
    mockDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const generatedIds: Record<string, string> = {
      "poder judiciario": "parent-uuid-1",
      "supremo tribunal federal": "child-uuid-2",
    };

    mockInsert.mockImplementation(() => ({
      values: (val: { name: string; normalizedName: string; parentNoticeTopicId: string | null }) => ({
        returning: async () => {
          const id = generatedIds[val.normalizedName] || `gen-${val.normalizedName}`;
          return [{ id, ...val }];
        },
      }),
    }));

    // Passamos o filho antes do pai na lista para testar ordenação topológica
    const inputs = [
      { name: "Supremo Tribunal Federal", parentName: "Poder Judiciário" },
      { name: "Poder Judiciário" },
    ];

    const res = await NoticeTopicRepository.replaceTopicsForNoticeSubject("subject-1", inputs);
    expect(res).toHaveLength(2);

    const parent = res.find((r) => r.name === "Poder Judiciário");
    const child = res.find((r) => r.name === "Supremo Tribunal Federal");

    expect(parent).toBeDefined();
    expect(child).toBeDefined();
    expect(parent?.parentNoticeTopicId).toBeNull();
    expect(child?.parentNoticeTopicId).toBe("parent-uuid-1");
  });

  it("formata pesos explicitados como string decimal ou null quando ausente", async () => {
    mockDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const capturedValues: Array<{ weight: string | null }> = [];
    mockInsert.mockImplementation(() => ({
      values: (val: { weight: string | null; normalizedName: string }) => ({
        returning: async () => {
          capturedValues.push(val);
          return [{ id: `id-${val.normalizedName}`, ...val }];
        },
      }),
    }));

    const inputs = [
      { name: "Tópico com peso", weight: 7.5 },
      { name: "Tópico sem peso" },
    ];

    await NoticeTopicRepository.replaceTopicsForNoticeSubject("subject-1", inputs);
    expect(capturedValues[0]?.weight).toBe("7.50");
    expect(capturedValues[1]?.weight).toBeNull();
  });
});
