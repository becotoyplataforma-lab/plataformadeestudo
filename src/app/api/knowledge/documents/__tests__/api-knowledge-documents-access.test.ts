/**
 * GET /api/knowledge/documents - listagem legivel pelo usuario.
 *
 * A listagem usa a mesma politica da busca: documentos proprios mais os
 * compartilhados com o escopo resolvido no backend. Se alguem voltar a usar
 * listByUser aqui, o aluno perde de novo o material do professor - o teste
 * trava exatamente isso.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

const mockResolveScope = vi.fn();
vi.mock("@/lib/knowledge/security/document-access", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/knowledge/security/document-access")
  >();
  return {
    ...actual,
    resolveAccessScope: (...a: unknown[]) => mockResolveScope(...a),
  };
});

const mockListAccessible = vi.fn();
const mockListByUser = vi.fn();
vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {
    listAccessible: (...a: unknown[]) => mockListAccessible(...a),
    listByUser: (...a: unknown[]) => mockListByUser(...a),
  },
}));
vi.mock("@/lib/dto/knowledge.dto", () => ({
  mapDocumentToDto: (d: unknown) => d,
}));

import { GET } from "@/app/api/knowledge/documents/route";

const STUDENT = "00000000-0000-4000-8000-0000000000bb";
const POS_A = "00000000-0000-4000-8000-0000000000c1";

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: STUDENT, email: "aluno@exemplo.com" } });
  mockResolveScope.mockResolvedValue({ userId: STUDENT, positionId: POS_A });
  mockListAccessible.mockResolvedValue([{ id: "doc-1" }, { id: "doc-2" }]);
});

describe("GET /api/knowledge/documents", () => {
  it("sem sessao devolve 401 e nao consulta nada", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockListAccessible).not.toHaveBeenCalled();
  });

  it("lista com o escopo resolvido no backend e limite fixo", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(mockResolveScope).toHaveBeenCalledWith(STUDENT, "aluno@exemplo.com");
    expect(mockListAccessible).toHaveBeenCalledWith(
      { userId: STUDENT, positionId: POS_A },
      100
    );
  });

  it("nao volta para a listagem apenas por posse", async () => {
    await GET();

    expect(mockListByUser).not.toHaveBeenCalled();
  });

  it("falha do banco devolve 500 sem vazar detalhe interno", async () => {
    mockListAccessible.mockRejectedValue(
      new Error("connection refused at s3://bucket-private")
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("s3://");
  });
});