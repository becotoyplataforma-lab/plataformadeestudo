/**
 * ConcursoAI — DocumentStorageService
 *
 * Armazenamento físico de documentos no Supabase Storage (bucket privado),
 * SEMPRE server-side via service role. Nunca use no client.
 *
 * Caminho no bucket: {userId}/{documentId}/{fileName}
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "documents";

export class StorageError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

export const DocumentStorageService = {
  async ensureBucket(): Promise<void> {
    const sb = createAdminClient();
    const { data } = await sb.storage.getBucket(BUCKET);
    if (!data) {
      const { error } = await sb.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 25 * 1024 * 1024,
      });
      if (error && !error.message.toLowerCase().includes("already exists")) {
        throw new StorageError("BUCKET_FAILED", error.message);
      }
    }
  },

  async upload(input: {
    userId: string;
    documentId: string;
    fileName: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<string> {
    await this.ensureBucket();
    const path = `${input.userId}/${input.documentId}/${input.fileName}`;
    const { error } = await createAdminClient()
      .storage.from(BUCKET)
      .upload(path, input.buffer, {
        contentType: input.mimeType,
        upsert: true,
      });
    if (error) throw new StorageError("UPLOAD_FAILED", error.message);
    return path;
  },

  async download(storagePath: string): Promise<Buffer> {
    const { data, error } = await createAdminClient()
      .storage.from(BUCKET)
      .download(storagePath);
    if (error || !data) {
      throw new StorageError("DOWNLOAD_FAILED", error?.message ?? "Arquivo não encontrado");
    }
    return Buffer.from(await data.arrayBuffer());
  },

  async remove(storagePath: string): Promise<void> {
    const { error } = await createAdminClient()
      .storage.from(BUCKET)
      .remove([storagePath]);
    if (error) throw new StorageError("REMOVE_FAILED", error.message);
  },
};
