/**
 * Testes do LocalStorageAdapter (driver "local") — specs/knowledge-apostilas.md.
 * Foca o contrato StorageAdapter e a guarda de path traversal, já que a `key`
 * vem de `documents.storage_path` (dado persistido, não confiado cegamente).
 */
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { LocalStorageAdapter } from "../local.adapter";
import { StorageError, type StorageAdapter } from "../types";

const CONTEUDO = new TextEncoder().encode("%PDF-1.4\napostila de teste\n%%EOF\n");

let raiz: string;
/** Testado através do contrato: os chamadores reais usam StorageAdapter. */
let adapter: StorageAdapter;
const criados: string[] = [];

async function coletar(body: ReadableStream<Uint8Array>): Promise<string> {
  const leitor = body.getReader();
  const partes: string[] = [];
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    if (value) partes.push(new TextDecoder().decode(value));
  }
  return partes.join("");
}

beforeAll(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), "apostilas-storage-"));
  adapter = new LocalStorageAdapter(raiz);
});

afterEach(async () => {
  await Promise.all(criados.splice(0).map((key) => adapter.delete(key)));
});

afterAll(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe("LocalStorageAdapter", () => {
  it("grava o arquivo dentro da raiz e devolve o tamanho", async () => {
    const key = "usuario-1/documento-1/apostila.pdf";
    criados.push(key);

    const resultado = await adapter.upload(key, CONTEUDO, "application/pdf");

    expect(resultado).toEqual({ key, size: CONTEUDO.byteLength });
    expect(await adapter.exists(key)).toBe(true);

    const fisico = path.resolve(raiz, ...key.split("/"));
    expect(fisico.startsWith(raiz)).toBe(true);
    expect((await stat(fisico)).size).toBe(CONTEUDO.byteLength);
  });

  it("lê o conteúdo inteiro com contentType deduzido", async () => {
    const key = "u/d/inteiro.pdf";
    criados.push(key);
    await adapter.upload(key, CONTEUDO);

    const stream = await adapter.getStream(key);
    const texto = await coletar(stream.body);

    expect(texto).toBe(new TextDecoder().decode(CONTEUDO));
    expect(stream.contentType).toBe("application/pdf");
    expect(stream.contentLength).toBe(CONTEUDO.byteLength);
    expect(stream.partial).toBe(false);
  });

  it("atende HTTP Range (bytes 0-4) sem ler o ficheiro inteiro", async () => {
    const key = "u/d/faixa.pdf";
    criados.push(key);
    await adapter.upload(key, CONTEUDO);

    const stream = await adapter.getStream(key, { start: 0, end: 4 });

    expect(await coletar(stream.body)).toBe("%PDF-");
    expect(stream.contentLength).toBe(5);
    expect(stream.partial).toBe(true);
  });

  it("aceita range aberto (start até ao fim)", async () => {
    const key = "u/d/cauda.pdf";
    criados.push(key);
    await adapter.upload(key, CONTEUDO);

    const stream = await adapter.getStream(key, { start: CONTEUDO.byteLength - 6, end: null });
    const texto = await coletar(stream.body);

    expect(texto).toBe("%%EOF\n");
  });

  it("falha com NOT_FOUND quando o arquivo não existe", async () => {
    await expect(adapter.getStream("u/d/ausente.pdf")).rejects.toMatchObject({
      code: "NOT_FOUND",
      name: "StorageError",
    });
    expect(await adapter.exists("u/d/ausente.pdf")).toBe(false);
  });

  it("recusa chaves com path traversal ou caminho absoluto", async () => {
    const perigosas = [
      "../../etc/passwd",
      "u/../../segredo.pdf",
      "/absoluto.pdf",
      "c:\\windows\\sistema.pdf",
      "u//d/../x.pdf",
      "",
      "   ",
    ];

    for (const key of perigosas) {
      await expect(adapter.upload(key, CONTEUDO)).rejects.toBeInstanceOf(StorageError);
      await expect(adapter.getStream(key)).rejects.toMatchObject({ code: "INVALID_KEY" });
    }
  });

  it("não expõe caminho local do disco via getUrl", async () => {
    await expect(adapter.getUrl("u/d/inteiro.pdf")).rejects.toMatchObject({
      code: "NOT_SUPPORTED",
    });
  });

  it("delete remove o arquivo e é tolerante a redelete", async () => {
    const key = "u/d/remover.pdf";
    await adapter.upload(key, CONTEUDO);

    await adapter.delete(key);
    expect(await adapter.exists(key)).toBe(false);

    await expect(adapter.delete(key)).resolves.toBeUndefined();
  });
});
