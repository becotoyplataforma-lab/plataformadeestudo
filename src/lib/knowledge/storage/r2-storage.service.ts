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

  async remove(storagePath: string): Promise<void> {
    const c = client();
    if (!c) throw new R2StorageError("NOT_CONFIGURED", "R2 não configurado.");
    await c.send(new DeleteObjectCommand({ Bucket: bucket(), Key: storagePath }));
  },
};
