/**
 * Testes do R2StorageService — mocka o S3Client via @aws-sdk/client-s3
 * (HeadBucket, PutObject, GetObject, DeleteObject, HeadObject).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return {
    ...actual,
    S3Client: class {
      send = sendMock;
    },
  };
});

import { R2StorageService, R2StorageError } from "@/lib/knowledge/storage/r2-storage.service";

const envBackup = { ...process.env };

beforeEach(() => {
  sendMock.mockReset();
  // R2 configurado por padrão nos testes de R2.
  process.env.R2_ACCOUNT_ID = "test-account";
  process.env.R2_ACCESS_KEY_ID = "test-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
  process.env.R2_BUCKET = "documents";
});

afterEach(() => {
  process.env = { ...envBackup };
});

describe("R2StorageService", () => {
  it("upload() envia ensureBucket + PutObjectCommand e retorna storagePath", async () => {
    sendMock.mockResolvedValue({});
    const result = await R2StorageService.upload({
      userId: "user-1",
      documentId: "doc-1",
      fileName: "apostila.pdf",
      buffer: Buffer.from("conteudo"),
      mimeType: "application/pdf",
    });
    expect(result).toBe("user-1/doc-1/apostila.pdf");
    // 1ª chamada: HeadBucket (ensureBucket); 2ª: PutObject.
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[0][0].constructor.name).toBe("HeadBucketCommand");
    const cmd = sendMock.mock.calls[1][0];
    expect(cmd.constructor.name).toBe("PutObjectCommand");
    expect(cmd.input).toMatchObject({
      Bucket: "documents",
      Key: "user-1/doc-1/apostila.pdf",
      ContentType: "application/pdf",
    });
  });

  it("download() retorna Buffer do GetObjectCommand", async () => {
    sendMock.mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });
    const buf = await R2StorageService.download("u/d/f.pdf");
    expect(Buffer.from(buf)).toEqual(Buffer.from([1, 2, 3]));
  });

  it("download() lança R2StorageError se Body ausente", async () => {
    sendMock.mockResolvedValue({ Body: undefined });
    await expect(R2StorageService.download("u/d/f.pdf")).rejects.toThrow(R2StorageError);
  });

  it("exists() retorna true quando HeadObjectCommand resolve", async () => {
    sendMock.mockResolvedValue({});
    expect(await R2StorageService.exists("u/d/f.pdf")).toBe(true);
    expect(sendMock.mock.calls[0][0].constructor.name).toBe("HeadObjectCommand");
  });

  it("exists() retorna false quando HeadObjectCommand lança NotFound", async () => {
    sendMock.mockRejectedValue({ name: "NotFound" });
    expect(await R2StorageService.exists("u/d/f.pdf")).toBe(false);
  });

  it("exists() relança R2StorageError para erro que não é NotFound", async () => {
    sendMock.mockRejectedValue(new Error("AccessDenied"));
    await expect(R2StorageService.exists("u/d/f.pdf")).rejects.toThrow(R2StorageError);
  });

  it("head() retorna ContentLength/ContentType", async () => {
    sendMock.mockResolvedValue({ ContentLength: 1234, ContentType: "application/pdf" });
    const meta = await R2StorageService.head("u/d/f.pdf");
    expect(meta).toEqual({ contentLength: 1234, contentType: "application/pdf" });
  });

  it("head() lança R2StorageError se objeto não existe", async () => {
    sendMock.mockRejectedValue(new Error("NoSuchKey"));
    await expect(R2StorageService.head("u/d/f.pdf")).rejects.toThrow(R2StorageError);
  });

  it("remove() envia DeleteObjectCommand", async () => {
    sendMock.mockResolvedValue({});
    await R2StorageService.remove("u/d/f.pdf");
    expect(sendMock.mock.calls[0][0].constructor.name).toBe("DeleteObjectCommand");
  });

  it("lança R2StorageError NOT_CONFIGURED sem credenciais", async () => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    await expect(R2StorageService.upload({
      userId: "u", documentId: "d", fileName: "f", buffer: Buffer.from("x"), mimeType: "text/plain",
    })).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });
});
