/**
 * Contrato de formatos: fonte unica de verdade do que a plataforma consegue
 * converter em texto pesquisavel.
 *
 * Tres camadas leem daqui:
 *   1. MCP de ingestao (apostila-mcp) - decide o que entra no corpus;
 *   2. IngestionService - valida o MIME do upload;
 *   3. DocumentExtractionService - extrai texto e recusa binario sem extrator.
 *
 * A regra e simetrica: um formato so e aceito se existir extrator implementado.
 * EPUB, DOC, RTF, ODT, PPT/PPTX, XLS/XLSX e imagens sao binarios (ou ZIP com
 * conteudo comprimido) que, se atravessassem a porta de entrada, virariam texto
 * inutil indexado no Knowledge Engine. Recusar na entrada e mais barato do que
 * limpar o corpus depois. OCR e extratores novos entram por este arquivo.
 */

/** Extensoes com extracao de texto realmente implementada. */
export const TEXT_EXTRACTABLE_EXTENSIONS = [
  "pdf",
  "docx",
  "txt",
  "md",
  "markdown",
  "html",
  "htm",
] as const;

/** Extensoes binarias/ZIP-like sem extrator: recusadas nominalmente. */
export const BINARY_NO_EXTRACTOR_EXTENSIONS = [
  "doc",
  "epub",
  "rtf",
  "odt",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
] as const;

/** Imagens: so entrariam com OCR, que ainda nao existe no projeto. */
export const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "tif",
  "tiff",
  "avif",
] as const;

/** Valores possiveis de documents.type produzidos pelo extrator. */
export type TextExtractableFormat = "pdf" | "docx" | "txt" | "markdown" | "html";

/**
 * MIMEs aceitos no upload. A ordem e a mesma historica do IngestionService;
 * o conteudo e o espelho exato de TEXT_EXTRACTABLE_EXTENSIONS.
 */
export const TEXT_EXTRACTABLE_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "text/html",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type TextExtractableMimeType = (typeof TEXT_EXTRACTABLE_MIME_TYPES)[number];

/** MIME -> documents.type. */
export const MIME_TO_DOCUMENT_TYPE: Record<string, TextExtractableFormat> = {
  "text/plain": "txt",
  "text/markdown": "markdown",
  "text/html": "html",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/** Extensao -> MIME (o CLI usa isto para classificar sem abrir o arquivo). */
export const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  html: "text/html",
  htm: "text/html",
};

/** MIME -> extensoes que o representam (relacao 1:N nos dois sentidos). */
export const MIME_TO_EXTENSIONS: Record<string, readonly string[]> = {
  "text/plain": ["txt"],
  "text/markdown": ["md", "markdown"],
  "text/html": ["html", "htm"],
  "application/pdf": ["pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
};

/** MIMEs de binarios sem extrator (recusados tambem na camada de extracao). */
export const BINARY_NO_EXTRACTOR_MIME_TYPES = [
  "application/msword",
  "application/epub+zip",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/** MIMEs de imagem (sem OCR). */
export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/avif",
  "image/svg+xml",
] as const;

/** Extrai a extensao minuscula de um nome de arquivo, sem valida-la. */
export function extensionOf(fileName: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(fileName ?? "");
  return match?.[1]?.toLowerCase() ?? "";
}

/**
 * Normaliza a extensao para o documents.type que o extrator entende.
 * Retorna null quando nao existe extrator para aquele formato.
 */
export function textFormatOf(extension: string): TextExtractableFormat | null {
  switch (extension.toLowerCase()) {
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    case "txt":
      return "txt";
    case "md":
    case "markdown":
      return "markdown";
    case "html":
    case "htm":
      return "html";
    default:
      return null;
  }
}

export function isTextExtractableExtension(extension: string): boolean {
  return textFormatOf(extension) !== null;
}

export function isImageExtension(extension: string): boolean {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(extension.toLowerCase());
}

export function isBinaryNoExtractorExtension(extension: string): boolean {
  return (BINARY_NO_EXTRACTOR_EXTENSIONS as readonly string[]).includes(extension.toLowerCase());
}

export function isTextExtractableMimeType(mimeType: string): boolean {
  return (TEXT_EXTRACTABLE_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function isImageMimeType(mimeType: string): boolean {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function isBinaryNoExtractorMimeType(mimeType: string): boolean {
  return (BINARY_NO_EXTRACTOR_MIME_TYPES as readonly string[]).includes(mimeType);
}

/** MIME esperado para uma extensao; null quando o formato nao e aceito. */
export function mimeForExtension(extension: string): string | null {
  return EXTENSION_TO_MIME[extension.toLowerCase()] ?? null;
}

/** Extensoes que representam um MIME; lista vazia quando o MIME nao e aceito. */
export function extensionsForMime(mimeType: string): readonly string[] {
  return MIME_TO_EXTENSIONS[mimeType] ?? [];
}

export type FormatFamily =
  | "text-extractable"
  | "image"
  | "binary-no-extractor"
  | "unknown";

/**
 * Classifica (arquivo, MIME) na familia que decide aceitacao ou recusa.
 * O MIME manda quando ele e conhecido: um .epub declarado como application/pdf
 * continua recusado pela extensao, e um arquivo sem extensao mas com MIME de
 * imagem e recusado pelo MIME.
 */
export function formatFamilyOf(fileName: string, mimeType?: string): FormatFamily {
  const ext = extensionOf(fileName);
  const mime = (mimeType ?? "").trim().toLowerCase();

  if (mime.length > 0 && mime !== "application/octet-stream") {
    if (isImageMimeType(mime)) return "image";
    if (isBinaryNoExtractorMimeType(mime)) return "binary-no-extractor";
  }
  if (isImageExtension(ext)) return "image";
  if (isBinaryNoExtractorExtension(ext)) return "binary-no-extractor";

  if (isTextExtractableExtension(ext)) {
    const expected = mimeForExtension(ext);
    const declaredMimeIsDifferentFamily =
      expected !== null && mime.length > 0 && mime !== expected &&
      !extensionsForMime(mime).includes(ext.toLowerCase());
    if (declaredMimeIsDifferentFamily && isTextExtractableMimeType(mime)) return "unknown";
    return "text-extractable";
  }

  if (mime.length > 0 && isTextExtractableMimeType(mime)) return "text-extractable";
  return "unknown";
}

/** Verdade quando o par (arquivo, MIME) tem extrator de texto real. */
export function isAcceptableDocument(fileName: string, mimeType?: string): boolean {
  return formatFamilyOf(fileName, mimeType) === "text-extractable";
}

/** Motivo legivel e seguro (nunca contem caminho absoluto) para uma recusa. */
export function describeFormatRejection(fileName: string, mimeType?: string): string {
  const ext = extensionOf(fileName);
  const family = formatFamilyOf(fileName, mimeType);
  if (family === "image") {
    return "Extensao de imagem sem OCR habilitado neste provedor: ." + (ext || "desconhecida");
  }
  if (family === "binary-no-extractor") {
    return (
      "Formato binario sem extrator de texto: ." + (ext || "desconhecido") +
      ". O conteudo seria indexado como lixo; converta para PDF com texto, DOCX, TXT, MD ou HTML."
    );
  }
  if (!ext) {
    return "Arquivo sem extensao reconhecivel: nao e possivel escolher um extrator.";
  }
  return (
    "Extensao nao suportada: ." + ext +
    ". Formatos com extracao de texto: " + TEXT_EXTRACTABLE_EXTENSIONS.join(", ") + "."
  );
}

/** Valores de documents.type que o extrator trata como texto puro. */
export const LEGACY_TEXT_DOCUMENT_TYPES = ["edital", "apostila"] as const;

/** documents.type com extrator real (os legados sao texto simples). */
export const EXTRACTABLE_DOCUMENT_TYPES = ["pdf", "docx", "txt", "markdown", "html", "edital", "apostila"] as const;

/** Verdade quando existe extrator de texto para o par (type, mime). */
export function hasTextExtractor(type: string, mimeType?: string): boolean {
  const mime = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  if (mime.length !== 0) {
    if (isImageMimeType(mime)) return false;
    if (isBinaryNoExtractorMimeType(mime)) return false;
    if (isTextExtractableMimeType(mime)) return true;
  }
  return (EXTRACTABLE_DOCUMENT_TYPES as readonly string[]).includes((type ?? "").trim().toLowerCase());
}

/** Motivo legivel para recusa na camada de extracao. */
export function describeExtractionRejection(type: string, mimeType?: string): string {
  const mime = (mimeType ?? "").trim() || "vazio";
  const kind = (type ?? "").trim() || "vazio";
  return "Sem extrator de texto para type=" + kind + " e mime=" + mime + ". Formatos com extrator: " + TEXT_EXTRACTABLE_EXTENSIONS.join(", ") + ".";
}
