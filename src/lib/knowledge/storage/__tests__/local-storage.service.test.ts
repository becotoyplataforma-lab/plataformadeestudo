/**
 * Testes unitários — adaptador de filesystem (STORAGE_BACKEND=local).
 *
 * Cobrimos o que torna o adaptador utilizável como cache de ingestão: a chave
 * gravada é a mesma dos backends remotos, o objeto só aparece depois do sha256
 * conferido, o sidecar carrega o contentType que o filesystem não guarda, e
 * nenhuma chave com `..` consegue escrever fora da raiz.
 */
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  LocalStorageError,
  LocalStorageService,
  resolveLocalObjectPath,
  resolveLocalStorageRoot,
} from "@/lib/knowledge/storage/local-storage.service";
import { sha256Hex } from "@/lib/knowledge/storage/contract";

const rootPath = resolve(tmpdir(), `ca-local-${Date.now()}`);
const originalLocalDir = process.env.STORAGE_LOCAL_DIR;

const upload = {
  userId: "owner-1",
  documentId: "doc-1",
  fileName: "13-TRT15-2024.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.7 apostila de teste\n".repeat(32), "utf8"),
};

beforeAll(() => {
  process.env.STORAGE_LOCAL_DIR = rootPath;
});

beforeEach(async () => {
  await rm(rootPath, { recursive: true, force: true });
  await mkdir(rootPath, { recursive: true });
});

afterAll(async () => {
  process.env.STORAGE_LOCAL_DIR = originalLocalDir;
  await rm(rootPath, { recursive: true, force: true });
});

describe("resolveLocalStorageRoot", () => {
  // Um cwd absoluto de verdade: `path.resolve("/repo")` em Windows devolve
  // "C:\repo", entao fixture com caminho relativo mascara o comportamento real.
  const fakeCwd = resolve(tmpdir(), "ca-storage-fixture-cwd");

  it("default é .storage/documents dentro do cwd", () => {
    expect(resolveLocalStorageRoot({}, fakeCwd)).toBe(join(fakeCwd, ".storage", "documents"));
  });

  it("valor relativo resolve contra o cwd", () => {
    expect(resolveLocalStorageRoot({ STORAGE_LOCAL_DIR: "cache/objetos" }, fakeCwd)).toBe(
      join(fakeCwd, "cache", "objetos")
    );
  });

  it("recusa a raiz do filesystem", () => {
    expect(() => resolveLocalStorageRoot({ STORAGE_LOCAL_DIR: "/" }, fakeCwd)).toThrowError(
      LocalStorageError
    );
  });

  it("recusa o próprio cwd como raiz de storage", () => {
    expect(() => resolveLocalStorageRoot({ STORAGE_LOCAL_DIR: "." }, fakeCwd)).toThrowError(
      /raiz do repositorio/
    );
  });
});

describe("resolveLocalObjectPath — contenção de path traversal", () => {
  it("resolve a chave canônica dentro da raiz", () => {
    expect(resolveLocalObjectPath("owner-1/doc-1/a.pdf", rootPath)).toBe(
      join(rootPath, "owner-1", "doc-1", "a.pdf")
    );
  });

  it.each(["../evil.txt", "owner-1/../../evil.txt", "/absolute/evil.txt", "owner-1//a.pdf", "./a.pdf"])(
    "recusa a chave %j",
    (key) => {
      expect(() => resolveLocalObjectPath(key, rootPath)).toThrowError(LocalStorageError);
    }
  );

  it("separador de Windows não atravessa a raiz", () => {
    expect(() => resolveLocalObjectPath("owner-1\\..\\..\\evil.txt", rootPath)).toThrowError(
      LocalStorageError
    );
  });
});

describe("LocalStorageService — ciclo de vida do objeto", () => {
  it("upload devolve a chave canônica e grava objeto + sidecar", async () => {
    const key = await LocalStorageService.upload(upload);
    expect(key).toBe("owner-1/doc-1/13-TRT15-2024.pdf");

    const stored = await readFile(join(rootPath, "owner-1", "doc-1", "13-TRT15-2024.pdf"));
    expect(stored.equals(upload.buffer)).toBe(true);

    const meta = JSON.parse(
      await readFile(join(rootPath, "owner-1", "doc-1", "13-TRT15-2024.pdf.meta.json"), "utf8")
    );
    expect(meta.sha256).toBe(sha256Hex(upload.buffer));
    expect(meta.contentType).toBe("application/pdf");
    expect(meta.sizeBytes).toBe(upload.buffer.byteLength);
  });

  it("não deixa ficheiro temporário depois do upload", async () => {
    await LocalStorageService.upload(upload);
    const files = await readdir(join(rootPath, "owner-1", "doc-1"));
    expect(files.filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("ensureBucket cria a raiz quando ela não existe", async () => {
    const nested = join(rootPath, "nivel-1", "nivel-2");
    process.env.STORAGE_LOCAL_DIR = nested;
    try {
      await LocalStorageService.ensureBucket();
      const info = await stat(nested);
      expect(info.isDirectory()).toBe(true);
    } finally {
      process.env.STORAGE_LOCAL_DIR = rootPath;
    }
  });

  it("download devolve exatamente os bytes gravados", async () => {
    const key = await LocalStorageService.upload(upload);
    const buffer = await LocalStorageService.download(key);
    expect(buffer.equals(upload.buffer)).toBe(true);
  });

  it("download de chave inexistente é NOT_FOUND", async () => {
    try {
      await LocalStorageService.download("owner-1/doc-1/ausente.pdf");
      expect.unreachable("objeto ausente deveria lançar");
    } catch (error) {
      expect((error as LocalStorageError).code).toBe("NOT_FOUND");
    }
  });

  it("head usa o sidecar para contentType e sha256", async () => {
    const key = await LocalStorageService.upload(upload);
    const info = await LocalStorageService.head(key);
    expect(info.contentLength).toBe(upload.buffer.byteLength);
    expect(info.contentType).toBe("application/pdf");
    expect(info.sha256).toBe(sha256Hex(upload.buffer));
  });

  it("exists é false antes e true depois do upload", async () => {
    const key = "owner-2/doc-2/notas.txt";
    expect(await LocalStorageService.exists(key)).toBe(false);
    await LocalStorageService.upload({
      userId: "owner-2",
      documentId: "doc-2",
      fileName: "notas.txt",
      mimeType: "text/markdown",
      buffer: Buffer.from("# notas", "utf8"),
    });
    expect(await LocalStorageService.exists(key)).toBe(true);
  });

  it("remove apaga objeto e sidecar, e é idempotente", async () => {
    const key = await LocalStorageService.upload(upload);
    await LocalStorageService.remove(key);

    await expect(stat(join(rootPath, "owner-1", "doc-1", "13-TRT15-2024.pdf"))).rejects.toThrow();
    await expect(
      stat(join(rootPath, "owner-1", "doc-1", "13-TRT15-2024.pdf.meta.json"))
    ).rejects.toThrow();

    await expect(LocalStorageService.remove(key)).resolves.toBeUndefined();
  });

  it("upload recusa chave que sairia da raiz", async () => {
    await expect(
      LocalStorageService.upload({ ...upload, fileName: "../../outside.txt" })
    ).rejects.toMatchObject({ code: "KEY_UNSAFE" });
  });
});
