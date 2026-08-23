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

// ============================================================
// Helpers
// ============================================================

function computeHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Sanitiza o nome do arquivo para uso seguro como storage path.
 * Remove path traversal (../, ..\), separadores de diretório e caracteres
 * de controle/especiais. Limita a 255 chars e garante um nome não vazio.
 */
function sanitizeFilename(filename: string): string {
  // Remove qualquer prefixo de diretório (Windows e POSIX).
  let name = filename.replace(/^.*[\\/]/, "");
  // Remove caracteres de controle e não imprimíveis.
  name = name.replace(/[\u0000-\u001f\u007f]/g, "");
  // Remove caracteres perigosos para storage/URL.
  name = name.replace(/[<>:"|?*]/g, "_");
  // Remove tentativas de path traversal remanescentes.
  name = name.replace(/\.\.+/g, ".");
  // Remove espaços/underscores duplicados e pontuação inicial.
  name = name.replace(/\s+/g, " ").trim();
  name = name.replace(/^[._]+/, "");
  // Limita o tamanho total (mantendo a extensão).
  if (name.length > 255) {
    const ext = name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "";
    name = name.slice(0, 255 - ext.length) + ext;
  }
  // Garante nome não vazio.
  if (!name) {
    name = `documento-${Date.now()}`;
  }
  return name;
}

/**
 * Verifica se um byte é um caractere ASCII imprimível (32-126) ou
 * tab/newline/carriage-return. Usado para validar conteúdo de texto.
 */
function isPrintableASCII(byte: number): boolean {
  return (byte >= 32 && byte <= 126) || byte === 0x09 || byte === 0x0a || byte === 0x0d;
}

/**
 * Valida os "magic bytes" do arquivo contra o MIME declarado.
 * Impede upload de arquivos com extensão/MIME falsos (ex.: executável
 * renomeado para .pdf). Retorna true se o conteúdo é consistente.
 */
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const head = buffer.subarray(0, 8);
  switch (mimeType) {
    case "application/pdf":
      // %PDF-
      return head.subarray(0, 4).toString("latin1") === "%PDF";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      // DOCX é um ZIP (PK\x03\x04). Além do header, verifica se o conteúdo
      // ZIP contém a estrutura interna de um DOCX real (word/). O diretório
      // central do ZIP lista os nomes dos arquivos internos, então "word/"
      // aparece mesmo no conteúdo compactado. Impede que qualquer ZIP
      // (ex.: malware.zip renomeado para .docx) passe como DOCX.
      if (!(head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07))) {
        return false;
      }
      // Procura "word/" nos primeiros 8KB (cobre o diretório central do ZIP).
      return buffer.subarray(0, 8192).includes(Buffer.from("word/", "latin1"));
    case "text/plain":
    case "text/markdown":
      // Texto: rejeita bytes nulos (indicam binário disfarçado de texto)
      // e exige que ≥95% dos bytes sejam caracteres imprimíveis (evita
      // scripts shell/executáveis pequenos passarem como .txt).
      if (buffer.subarray(0, 1024).includes(0x00)) return false;
      if (buffer.length === 0) return false;
      const printableCount = buffer.reduce(
        (count, byte) => count + (isPrintableASCII(byte) ? 1 : 0),
        0
      );
      return printableCount / buffer.length >= 0.95;
    case "text/html":
      // Texto: rejeita bytes nulos (indicam binário disfarçado de texto).
      return !buffer.subarray(0, 1024).includes(0x00);
    default:
      return true;
  }
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

    // 3.1 Validar magic bytes (conteúdo consistente com o MIME declarado).
    if (!validateMagicBytes(buffer, file.type)) {
      throw new IngestionError(
        "INVALID_CONTENT",
        "O conteúdo do arquivo não corresponde ao tipo declarado. Verifique o arquivo e tente novamente."
      );
    }

    // 4. Verificar duplicação
    const existing = await DocumentRepository.findByHash(userId, fileHash);
    if (existing) {
      throw new IngestionError(
        "DUPLICATE_FILE",
        "Este arquivo já foi enviado",
        { existingDocumentId: existing.id }
      );
    }

    // 5. Storage path no R2 (nome sanitizado contra path traversal).
    const docId = crypto.randomUUID();
    const safeName = sanitizeFilename(file.name);
    const storagePath = `${userId}/${docId}/${safeName}`;

    // 6. Upload para R2 (delegado ao API route; aqui apenas registramos)
    // O upload real para R2 é feito via Supabase Storage no API handler.
    // O Service registra a intenção; o handler faz o upload físico.

    // 7. Criar documento no banco
    const document = await DocumentRepository.create({
      id: docId,
      userId,
      type: mapMimeToType(file.type),
      title: deriveTitle(safeName),
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
