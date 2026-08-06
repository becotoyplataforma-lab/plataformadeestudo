/**
 * ConcursoAI — IngestionService
 *
 * Orquestra o upload de documentos: validação, deduplicação,
 * armazenamento no Cloudflare R2 e registro no banco.
 *
 * Segue: .ai/blueprints/01-ingestion.blueprint.md
 */
import { createHash } from "crypto";
import { DocumentRepository } from "../repositories/document.repository";

// ============================================================
// Tipos
// ============================================================

export interface IngestionInput {
  userId: string;
  file: File;
  sourceType?: "upload" | "edital" | "url";
  sourceUrl?: string;
  externalId?: string;
}

export interface IngestionOutput {
  documentId: string;
  storagePath: string;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  status: string;
  createdAt: Date;
}

// ============================================================
// Constantes
// ============================================================

const ALLOWED_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "text/html",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

const MIME_TO_TYPE: Record<string, string> = {
  "text/plain": "txt",
  "text/markdown": "markdown",
  "text/html": "html",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const MAX_FILE_SIZE_FREE = 25 * 1024 * 1024; // 25 MB
const MAX_FILE_SIZE_PRO = 100 * 1024 * 1024; // 100 MB

// ============================================================
// Helpers
// ============================================================

function computeHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function deriveTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim();
}

function mapMimeToType(mimeType: string): "pdf" | "docx" | "txt" | "markdown" | "html" | "edital" | "apostila" {
  const mapped = MIME_TO_TYPE[mimeType];
  if (mapped === "pdf" || mapped === "docx" || mapped === "txt" || mapped === "markdown" || mapped === "html" || mapped === "edital" || mapped === "apostila") {
    return mapped;
  }
  return "txt";
}

// ============================================================
// Service
// ============================================================

export const IngestionService = {
  /**
   * Orquestrar upload completo.
   * Fluxo: validar → hash → dedup → R2 → register → DTO.
   */
  async ingest(input: IngestionInput): Promise<IngestionOutput> {
    const { userId, file, sourceType = "upload", sourceUrl, externalId } = input;

    // 1. Validar MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
      throw new IngestionError("INVALID_TYPE", `Tipo de arquivo não permitido: ${file.type}`);
    }

    // 2. Validar tamanho (assumindo plano Free; Pro validado via Billing)
    if (file.size > MAX_FILE_SIZE_FREE) {
      throw new IngestionError("FILE_TOO_LARGE", `Arquivo excede o limite de 25 MB`);
    }

    // 3. Calcular hash
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = computeHash(buffer);

    // 4. Verificar duplicação
    const existing = await DocumentRepository.findByHash(userId, fileHash);
    if (existing) {
      throw new IngestionError(
        "DUPLICATE_FILE",
        "Este arquivo já foi enviado",
        { existingDocumentId: existing.id }
      );
    }

    // 5. Storage path no R2
    const docId = crypto.randomUUID();
    const storagePath = `${userId}/${docId}/${file.name}`;

    // 6. Upload para R2 (delegado ao API route; aqui apenas registramos)
    // O upload real para R2 é feito via Supabase Storage no API handler.
    // O Service registra a intenção; o handler faz o upload físico.

    // 7. Criar documento no banco
    const document = await DocumentRepository.create({
      id: docId,
      userId,
      type: mapMimeToType(file.type),
      title: deriveTitle(file.name),
      storagePath,
      status: "pending",
      fileSize: file.size,
      mimeType: file.type,
      sourceType,
      sourceUrl: sourceUrl ?? undefined,
      externalId: externalId ?? undefined,
      fileHash,
      metadata: {},
    });

    return {
      documentId: document.id,
      storagePath: document.storagePath,
      fileHash: document.fileHash ?? "",
      fileSize: document.fileSize ?? 0,
      mimeType: document.mimeType ?? "",
      status: document.status,
      createdAt: document.createdAt,
    };
  },

  /** Verificar se upload cabe na cota do usuário. */
  async validateQuota(userId: string, fileSize: number, planLimit: number): Promise<void> {
    const used = await DocumentRepository.getStorageUsage(userId);
    if (used + fileSize > planLimit) {
      throw new IngestionError(
        "QUOTA_EXCEEDED",
        `Você atingiu o limite de armazenamento do seu plano`,
        { usedBytes: used, limitBytes: planLimit }
      );
    }
  },
};

// ============================================================
// Error
// ============================================================

export class IngestionError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "IngestionError";
    this.code = code;
    this.details = details;
  }
}
