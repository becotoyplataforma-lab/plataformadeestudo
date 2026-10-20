/**
 * ConcursoAI — Testes do modo `--do-manifesto` (`npm run apostila:sync`)
 *
 * Este é o comando que o usuário corre depois de criar o `.env.local`: pega os
 * bytes que já estão no storage e inserem a linha em `documents`. Os
 * repositórios são mockados (não há banco no CI), mas o storage é o
 * `LocalStorageAdapter` verdadeiro num diretório temporário — assim as asserções
 * sobre bytes (lidos, movidos, preservados, revertidos) são reais.
 */
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { setStorageForTests, type StorageAdapter } from "@/lib/storage";
import { LocalStorageAdapter } from "@/lib/storage/local.adapter";
import {
  opcoesPadrao,
  sincronizarManifesto,
  type Opcoes,
  type RegistroPendente,
} from "../ingest-local-apostila";

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  findByHash: vi.fn(),
  create: vi.fn(),
  softDelete: vi.fn(),
  upsert: vi.fn(),
  findByName: vi.fn(),
}));

vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {
    findById: mocks.findById,
    findByHash: mocks.findByHash,
    create: mocks.create,
    softDelete: mocks.softDelete,
  },
}));
vi.mock("@/lib/knowledge/repositories/junction.repository", () => ({
  DocumentSubjectRepository: { upsert: mocks.upsert },
}));
vi.mock("@/lib/knowledge/repositories/subject.repository", () => ({
  KnowledgeSubjectRepository: { findByName: mocks.findByName },
}));

const USUARIO = "00000000-0000-4000-8000-000000000001";
const USUARIO_REAL = "11111111-1111-4111-8111-111111111111";
const DOC_ID = "8fa777bb-0462-4ee2-95a2-a1e0a7c5d0f8";
const NOME_ARQUIVO = "curso-384118-aula-01-completo.pdf";
const CHAVE = `${USUARIO}/${DOC_ID}/${NOME_ARQUIVO}`;
const CHAVE_REAL = `${USUARIO_REAL}/${DOC_ID}/${NOME_ARQUIVO}`;

let raiz = "";
let diretorio = "";
let manifesto = "";
let storage: StorageAdapter;
let conteudo = new Uint8Array();
let sha = "";
let urlAnterior: string | undefined;
let warnSpy: Mock;

function registro(ajustes: Partial<RegistroPendente> = {}): RegistroPendente {
  return {
    documentId: DOC_ID,
    userId: USUARIO,
    type: "pdf",
    title: "Aula 01 - Completo",
    storagePath: CHAVE,
    mimeType: "application/pdf",
    fileSize: conteudo.byteLength,
    fileHash: sha,
    metadata: { concurso: "CBM-RJ" },
    subjectName: "Português",
    storageDriver: "local",
    criadoEm: new Date().toISOString(),
    ...ajustes,
  };
}

function opcoes(ajustes: Partial<Opcoes> = {}): Opcoes {
  return { ...opcoesPadrao(), sync: true, manifesto, ...ajustes };
}

async function escreveManifesto(...registros: RegistroPendente[]): Promise<void> {
  await writeFile(manifesto, JSON.stringify(registros, null, 2), "utf8");
}

async function leManifesto(): Promise<RegistroPendente[]> {
  try {
    return JSON.parse(await readFile(manifesto, "utf8")) as RegistroPendente[];
  } catch {
    return [];
  }
}

function caminhoNaDisco(chave: string): string {
  return path.join(diretorio, ...chave.split("/"));
}

beforeEach(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), "apostila-sync-"));
  diretorio = path.join(raiz, "storage");
  manifesto = path.join(raiz, "pending-ingest.json");
  storage = new LocalStorageAdapter(diretorio);
  setStorageForTests(storage);

  conteudo = new TextEncoder().encode("%PDF-1.5\napostila fake para o sync\n%%EOF\n");
  sha = createHash("sha256").update(conteudo).digest("hex");
  await storage.upload(CHAVE, conteudo, "application/pdf");

  mocks.findById.mockResolvedValue(null);
  mocks.findByHash.mockResolvedValue(null);
  mocks.findByName.mockResolvedValue(null);
  mocks.upsert.mockResolvedValue(undefined);
  mocks.softDelete.mockResolvedValue(null);
  mocks.create.mockImplementation((input: Record<string, unknown>) =>
    Promise.resolve({ ...input })
  );

  urlAnterior = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgres://sync-teste@localhost:5432/teste";
  vi.spyOn(console, "log").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  if (urlAnterior === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = urlAnterior;
  setStorageForTests(null);
  vi.restoreAllMocks();
  vi.clearAllMocks();
  await rm(raiz, { recursive: true, force: true });
});


describe("apostila:sync — manifesto -> documents", () => {
  it("insere a linha apontando para os bytes já gravados e limpa o manifesto", async () => {
    await escreveManifesto(registro());

    await sincronizarManifesto(opcoes());

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      id: DOC_ID,
      userId: USUARIO,
      type: "pdf",
      title: "Aula 01 - Completo",
      storagePath: CHAVE,
      status: "pending",
      mimeType: "application/pdf",
      fileSize: conteudo.byteLength,
      fileHash: sha,
      metadata: { concurso: "CBM-RJ" },
    });

    // os bytes não foram tocados: continuam os mesmos em disco
    const lidos = await readFile(caminhoNaDisco(CHAVE));
    expect(lidos.equals(Buffer.from(conteudo))).toBe(true);

    // manifesto esvaziado -> o ficheiro é removido (nada a repetir na próxima corrida)
    expect(await leManifesto()).toEqual([]);
    await expect(readFile(manifesto, "utf8")).rejects.toThrow();
  });

  it("vincula a matéria quando ela existe em knowledge_subjects", async () => {
    mocks.findByName.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222" });
    await escreveManifesto(registro());

    await sincronizarManifesto(opcoes());

    expect(mocks.findByName).toHaveBeenCalledWith("Português");
    expect(mocks.upsert).toHaveBeenCalledWith(
      DOC_ID,
      "22222222-2222-4222-8222-222222222222",
      100
    );
  });

  it("registra sem vínculo quando a matéria ainda não foi semeada", async () => {
    await escreveManifesto(registro({ subjectName: "Direito Penal" }));

    await sincronizarManifesto(opcoes());

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe("apostila:sync — integridade dos bytes", () => {
  it("não insere quando o SHA-256 do storage difere do manifesto", async () => {
    await storage.upload(CHAVE, new TextEncoder().encode("%PDF-1.5 conteúdo corrompido"), "application/pdf");
    await escreveManifesto(registro());

    await sincronizarManifesto(opcoes());

    expect(mocks.create).not.toHaveBeenCalled();
    const restantes = await leManifesto();
    expect(restantes).toHaveLength(1);
    expect(restantes[0].documentId).toBe(DOC_ID);
  });

  it("não insere quando o tamanho difere do manifesto", async () => {
    await escreveManifesto(registro({ fileSize: conteudo.byteLength + 1 }));

    await sincronizarManifesto(opcoes());

    expect(mocks.create).not.toHaveBeenCalled();
    expect(await leManifesto()).toHaveLength(1);
  });

  it("mantém o registro quando os bytes não estão no storage", async () => {
    await storage.delete(CHAVE);
    await escreveManifesto(registro());

    await sincronizarManifesto(opcoes());

    expect(mocks.create).not.toHaveBeenCalled();
    expect(await leManifesto()).toHaveLength(1);
  });

  it("é idempotente: linha já existente na mesma chave sai do manifesto sem novo insert", async () => {
    mocks.findById.mockResolvedValue({ id: DOC_ID, storagePath: CHAVE });
    await escreveManifesto(registro());

    await sincronizarManifesto(opcoes());

    expect(mocks.create).not.toHaveBeenCalled();
    expect(await leManifesto()).toEqual([]);
  });

  it("não duplica quando o mesmo SHA-256 já foi registrado", async () => {
    mocks.findByHash.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });
    await escreveManifesto(registro());

    await sincronizarManifesto(opcoes());

    expect(mocks.create).not.toHaveBeenCalled();
    expect(await storage.exists(CHAVE)).toBe(true); // bytes originais preservados
    expect(await leManifesto()).toEqual([]);
  });

  it("falhar DATABASE_URL não grava nada", async () => {
    delete process.env.DATABASE_URL;
    await escreveManifesto(registro());

    await expect(sincronizarManifesto(opcoes())).rejects.toThrow(/DATABASE_URL ausente/);

    expect(mocks.create).not.toHaveBeenCalled();
    expect(await leManifesto()).toHaveLength(1);
  });
});

describe("apostila:sync — troca de dono (--usuario) e rollback", () => {
  it("re-indexa os bytes para a chave do dono real e registra a nova chave", async () => {
    await escreveManifesto(registro());

    await sincronizarManifesto(opcoes({ usuario: USUARIO_REAL, usuarioDefinido: true }));

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      userId: USUARIO_REAL,
      storagePath: CHAVE_REAL,
      fileHash: sha,
    });

    const movidos = await readFile(caminhoNaDisco(CHAVE_REAL));
    expect(movidos.equals(Buffer.from(conteudo))).toBe(true);
    expect(await storage.exists(CHAVE)).toBe(false); // chave antiga só sai depois do insert
    expect(await leManifesto()).toEqual([]);
  });

  it("reverte a nova chave quando o insert falha (não deixa bytes órfãos)", async () => {
    mocks.create.mockRejectedValueOnce(new Error("duplicate key value violates unique constraint"));
    await escreveManifesto(registro());

    await sincronizarManifesto(opcoes({ usuario: USUARIO_REAL, usuarioDefinido: true }));

    expect(await storage.exists(CHAVE_REAL)).toBe(false);
    expect(await storage.exists(CHAVE)).toBe(true); // originais intactos
    const restantes = await leManifesto();
    expect(restantes).toHaveLength(1);
    expect(restantes[0].storagePath).toBe(CHAVE);
  });

  it("desfaz a linha quando o vínculo de matéria falha", async () => {
    mocks.findByName.mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444" });
    mocks.upsert.mockRejectedValueOnce(new Error("fk document_subjects_subject_id"));
    await escreveManifesto(registro());

    await sincronizarManifesto(opcoes());

    expect(mocks.softDelete).toHaveBeenCalledWith(DOC_ID);
    expect(await storage.exists(CHAVE)).toBe(true);
    expect(await leManifesto()).toHaveLength(1);
  });

  it("aceita mais de um registro e só remove do manifesto os que resolveu", async () => {
    const outraId = "9fa777bb-0462-4ee2-95a2-a1e0a7c5d0f9";
    const outraChave = `${USUARIO}/${outraId}/outra-aula.pdf`;
    const outroConteudo = new TextEncoder().encode("%PDF-1.5 segunda apostila\n");
    await storage.upload(outraChave, outroConteudo, "application/pdf");

    await escreveManifesto(
      registro(),
      registro({
        documentId: outraId,
        storagePath: outraChave,
        title: "Aula 02",
        fileSize: outroConteudo.byteLength,
        fileHash: createHash("sha256").update(outroConteudo).digest("hex"),
      }),
      registro({
        documentId: "aaaaaaa1-1111-4111-8111-111111111111",
        storagePath: `${USUARIO}/aaaaaaa1-1111-4111-8111-111111111111/aula-03.pdf`,
        title: "Aula 03 (bytes ausentes)",
        fileHash: "0".repeat(64),
      })
    );

    await sincronizarManifesto(opcoes());

    expect(mocks.create).toHaveBeenCalledTimes(2);
    const restantes = await leManifesto();
    expect(restantes).toHaveLength(1);
    expect(restantes[0].title).toBe("Aula 03 (bytes ausentes)");
  });
});
