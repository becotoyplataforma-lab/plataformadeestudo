import "server-only";

/**
 * ConcursoAI — R2StorageAdapter (driver "r2")
 *
 * Cloudflare R2 através da API S3-compatível (@aws-sdk/client-s3), conforme
 * previsto em src/lib/knowledge/services/ingestion.service.ts (cabeçalho) e
 * em .env.example (bloco "Cloudflare R2").
 *
 * Segue: specs/knowledge-apostilas.md (DD-STORAGE-02)
 */
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  assertSafeKey,
  StorageError,
  type StorageAdapter,
  type StorageRange,
  type StorageStream,
  type UploadResult,
} from "./types";

export interface R2Config {
  /** Conta Cloudflare (usada no endpoint <account>.r2.cloudflarestorage.com). */
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Domínio público opcional; sem ele, getUrl() gera URL pré-assinada. */
  publicUrl?: string;
}

const DEFAULT_SIGNED_URL_TTL_SEC = 300;

export class R2StorageAdapter implements StorageAdapter {
  readonly driver = "r2" as const;
  private readonly client: S3Client;

  constructor(private readonly config: R2Config) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  private keyOf(key: string): string {
    const segments = assertSafeKey(key);
    return segments.join("/");
  }

  async upload(key: string, body: Uint8Array, contentType?: string): Promise<UploadResult> {
    const objectKey = this.keyOf(key);
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: objectKey,
          Body: body,
          ContentType: contentType ?? "application/octet-stream",
        })
      );
      return { key: objectKey, size: body.byteLength };
    } catch {
      throw new StorageError("UPLOAD_FAILED", "Falha ao enviar o arquivo para o storage.");
    }
  }

  async getStream(key: string, range?: StorageRange): Promise<StorageStream> {
    const objectKey = this.keyOf(key);
    const rangeHeader = range ? formatRange(range) : undefined;

    try {
      const output = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: objectKey,
          Range: rangeHeader,
        })
      );

      return {
        body: toWebStream(output.Body),
        contentLength: output.ContentLength ?? null,
        contentType: output.ContentType ?? null,
        etag: output.ETag ?? null,
        lastModified: output.LastModified ?? null,
        partial: rangeHeader !== undefined,
        rangeStart: range?.start ?? 0,
        rangeEnd: range?.end ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) {
        throw new StorageError("NOT_FOUND", "Arquivo não encontrado no storage.");
      }
      throw new StorageError("READ_FAILED", "Falha ao ler o arquivo do storage.");
    }
  }

  async getUrl(key: string, options?: { expiresInSec?: number }): Promise<string> {
    const objectKey = this.keyOf(key);

    if (this.config.publicUrl) {
      const base = this.config.publicUrl.replace(/\/+$/, "");
      return `${base}/${objectKey}`;
    }

    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.config.bucket, Key: objectKey }),
        { expiresIn: options?.expiresInSec ?? DEFAULT_SIGNED_URL_TTL_SEC }
      );
    } catch {
      throw new StorageError("READ_FAILED", "Falha ao gerar URL de acesso ao arquivo.");
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: this.keyOf(key) })
      );
    } catch {
      throw new StorageError("READ_FAILED", "Falha ao remover o arquivo do storage.");
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: this.keyOf(key) })
      );
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw new StorageError("READ_FAILED", "Falha ao verificar o arquivo no storage.");
    }
  }
}

/** "bytes=START-END" (END em aberto quando null). */
function formatRange(range: StorageRange): string {
  return range.end === null
    ? `bytes=${range.start}-`
    : `bytes=${range.start}-${range.end}`;
}

/** O SDK devolve stream Node ou Web conforme o runtime. */
function toWebStream(body: unknown): ReadableStream<Uint8Array> {
  if (body && typeof (body as ReadableStream<Uint8Array>).getReader === "function") {
    return body as ReadableStream<Uint8Array>;
  }
  if (body instanceof Readable) {
    return Readable.toWeb(body) as unknown as ReadableStream<Uint8Array>;
  }
  throw new StorageError("READ_FAILED", "Formato de resposta do storage não suportado.");
}

function isNotFound(error: unknown): boolean {
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    candidate?.name === "NotFound" ||
    candidate?.name === "NoSuchKey" ||
    candidate?.$metadata?.httpStatusCode === 404
  );
}
