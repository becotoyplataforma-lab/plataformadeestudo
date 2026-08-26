/**
 * ConcursoAI — R2StorageService
 *
 * Storage em Cloudflare R2 (API S3-compatível), server-only.
 * Ativado automaticamente quando R2_ACCESS_KEY_ID está configurado.
 *
 * Env necessárias (nomes — NUNCA versionar valores):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *   (opcional) R2_ENDPOINT — default https://<account>.r2.cloudflarestorage.com
 */
import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const DEFAULT_BUCKET = "documents";

export class R2StorageError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "R2StorageError";
    this.code = code;
  }
}

function bucket(): string {
  return process.env.R2_BUCKET ?? DEFAULT_BUCKET;
}

function client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;

  const endpoint =
    process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`;

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // Retry razoável para falhas transitórias de rede (default AWS é 3).
    maxAttempts: 3,
  });
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
  );
}

export const R2StorageService = {
  async ensureBucket(): Promise<void> {
    const c = client();
    if (!c) throw new R2StorageError("NOT_CONFIGURED", "R2 não configurado.");
    try {
      await c.send(new HeadBucketCommand({ Bucket: bucket() }));
    } catch {
      throw new R2StorageError(
        "BUCKET_MISSING",
        `Bucket R2 "${bucket()}" não encontrado. Crie-o no dashboard Cloudflare (R2).`
      );
    }
  },

  async upload(input: {
    userId: string;
    documentId: string;
    fileName: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<string> {
    const c = client();
    if (!c) throw new R2StorageError("NOT_CONFIGURED", "R2 não configurado.");
    await this.ensureBucket();
    const path = `${input.userId}/${input.documentId}/${input.fileName}`;
    await c.send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: path,
        Body: input.buffer,
        ContentType: input.mimeType,
      })
    );
    return path;
  },

  async download(storagePath: string): Promise<Buffer> {
    const c = client();
    if (!c) throw new R2StorageError("NOT_CONFIGURED", "R2 não configurado.");
    const res = await c.send(
      new GetObjectCommand({ Bucket: bucket(), Key: storagePath })
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) {
      throw new R2StorageError("DOWNLOAD_FAILED", "Arquivo não encontrado no R2.");
    }
    return Buffer.from(bytes);
  },

  /**
   * Verifica se o objeto existe no R2 (HeadObject).
   * Retorna true se encontrado; false se não existe (404).
   * Lança R2StorageError para outros erros (credenciais, rede, etc.).
   */
  async exists(storagePath: string): Promise<boolean> {
    const c = client();
    if (!c) throw new R2StorageError("NOT_CONFIGURED", "R2 não configurado.");
    try {
      await c.send(new HeadObjectCommand({ Bucket: bucket(), Key: storagePath }));
      return true;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "NotFound"
      ) {
        return false;
      }
      throw new R2StorageError(
        "HEAD_FAILED",
        error instanceof Error ? error.message : "Falha ao consultar objeto no R2."
      );
    }
  },

  /**
   * Retorna metadados do objeto (ContentLength e ContentType).
   * Lança R2StorageError se o objeto não existir.
   */
  async head(storagePath: string): Promise<{ contentLength: number; contentType: string }> {
    const c = client();
    if (!c) throw new R2StorageError("NOT_CONFIGURED", "R2 não configurado.");
    try {
      const res = await c.send(
        new HeadObjectCommand({ Bucket: bucket(), Key: storagePath })
      );
      return {
        contentLength: res.ContentLength ?? 0,
        contentType: res.ContentType ?? "application/octet-stream",
      };
    } catch (error) {
      throw new R2StorageError(
        "HEAD_FAILED",
        error instanceof Error ? error.message : "Falha ao consultar objeto no R2."
      );
    }
  },

  async remove(storagePath: string): Promise<void> {
    const c = client();
    if (!c) throw new R2StorageError("NOT_CONFIGURED", "R2 não configurado.");
    await c.send(new DeleteObjectCommand({ Bucket: bucket(), Key: storagePath }));
  },
};
