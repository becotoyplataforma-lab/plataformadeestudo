/**
 * Homologação real: GET /api/apostilas/[id]/arquivo servindo o PDF ingerido pela CLI.
 *
 * Diferente dos testes de unidade (storage mockado), este exercício usa o
 * `getStorage()` REAL com o driver local e o PDF gravado por
 * `npm run apostila:ingest` (manifesto `.storage/pending-ingest.json`).
 * Fica `skip` quando o artefato de dev não existe (CI/clone limpo) — nunca falha
 * por ausência de `.env.local` (.ai/11-TDD-STRICT, specs/knowledge-apostilas.md).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/auth", () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));

const mockFindOwnedById = vi.fn();
vi.mock("@/lib/knowledge/repositories/apostilas.repository", () => ({
  ApostilasRepository: {
    listByUser: vi.fn().mockResolvedValue([]),
    findOwnedById: (...args: unknown[]) => mockFindOwnedById(...args),
  },
}));

import { env } from "@/lib/env";
import { resolveLocalStorageRoot } from "@/lib/storage";
import { GET } from "@/app/api/apostilas/[id]/arquivo/route";

interface RegistroPendente {
  documentId: string;
  userId: string;
  type: string;
  title: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  metadata: Record<string, unknown>;
  subjectName: string | null;
  storageDriver: string;
  criadoEm: string;
}

/** Primeiro registro ingerido por CLI, se houver artefato de dev. */
function lerRegistro(): RegistroPendente | null {
  const manifesto = path.resolve(process.cwd(), ".storage", "pending-ingest.json");
  try {
    const dados: unknown = JSON.parse(readFileSync(manifesto, "utf8"));
    if (!Array.isArray(dados) || dados.length === 0) return null;
    return dados[0] as RegistroPendente;
  } catch {
    return null;
  }
}

function caminhoFisico(chave: string): string {
  return path.join(resolveLocalStorageRoot(), ...chave.split("/"));
}

function linhaDaApostila(registro: RegistroPendente) {
  return {
    id: registro.documentId,
    userId: registro.userId,
    type: registro.type,
    title: registro.title,
    storagePath: registro.storagePath,
    status: "pending",
    fileSize: registro.fileSize,
    mimeType: registro.mimeType,
    metadata: registro.metadata,
    createdAt: new Date(registro.criadoEm),
  };
}

function contexto(id: string) {
  return { params: Promise.resolve({ id }) };
}

function requisicao(range?: string): NextRequest {
  return new NextRequest("http://localhost/api/apostilas/x/arquivo", {
    headers: range ? { range } : {},
  });
}

const registro = lerRegistro();
const temDriverLocal = env.STORAGE_DRIVER === "local";
const temBytes = registro ? existsSync(caminhoFisico(registro.storagePath)) : false;
const PODE_TESTAR = Boolean(registro && temDriverLocal && temBytes);

describe("GET /api/apostilas/[id]/arquivo — PDF real ingerido por CLI", () => {
  it.skipIf(!PODE_TESTAR)(
    "serve os bytes completos com 200 (sem 404) e hash idêntico ao ingerido",
    async () => {
      if (!registro) return;
      mockAuth.mockResolvedValue({ user: { id: registro.userId } });
      mockFindOwnedById.mockImplementation(async (userId: string, id: string) =>
        userId === registro.userId && id === registro.documentId ? linhaDaApostila(registro) : null
      );

      const res = await GET(requisicao(), contexto(registro.documentId));

      expect(res.status).not.toBe(404);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Content-Length")).toBe(String(registro.fileSize));
      expect(res.headers.get("Accept-Ranges")).toBe("bytes");
      expect(res.headers.get("Content-Disposition")).toContain("filename*=UTF-8''Aula");

      const corpo = new Uint8Array(await res.arrayBuffer());
      expect(corpo.byteLength).toBe(registro.fileSize);
      expect(Buffer.from(corpo.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
      expect(createHash("sha256").update(corpo).digest("hex")).toBe(registro.fileHash);
    }
  );

  it.skipIf(!PODE_TESTAR)(
    "atende Range do leitor de PDF com 206 e Content-Range correto",
    async () => {
      if (!registro) return;
      mockAuth.mockResolvedValue({ user: { id: registro.userId } });
      mockFindOwnedById.mockImplementation(async (userId: string, id: string) =>
        userId === registro.userId && id === registro.documentId ? linhaDaApostila(registro) : null
      );

      const res = await GET(requisicao("bytes=0-3"), contexto(registro.documentId));

      expect(res.status).toBe(206);
      expect(res.headers.get("Content-Range")).toBe(`bytes 0-3/${registro.fileSize}`);
      expect(res.headers.get("Content-Length")).toBe("4");
      expect(Buffer.from(new Uint8Array(await res.arrayBuffer())).toString("latin1")).toBe("%PDF");
    }
  );

  it.skipIf(!PODE_TESTAR)(
    "devolve 404 quando a sessão não é dona do documento (bytes não vazam)",
    async () => {
      if (!registro) return;
      const invasor = "99999999-9999-4999-8999-999999999999";
      mockAuth.mockResolvedValue({ user: { id: invasor } });
      mockFindOwnedById.mockImplementation(async (userId: string, id: string) =>
        userId === registro.userId && id === registro.documentId ? linhaDaApostila(registro) : null
      );

      const res = await GET(requisicao(), contexto(registro.documentId));

      expect(res.status).toBe(404);
    }
  );
});
