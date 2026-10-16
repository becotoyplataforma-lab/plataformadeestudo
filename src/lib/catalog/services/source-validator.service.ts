/**
 * CatalogSourceValidator (FASE 4).
 *
 * Turns a CatalogSourceInput into analysed text plus provenance, or refuses it.
 * Hard rules of this phase:
 *  - never performs network I/O: a declared URL is recorded, not fetched;
 *  - never touches the database; the catalog comes from the read-only snapshot;
 *  - delegates format acceptance to the existing format contract, so a binary
 *    without an extractor cannot become analysable text here.
 */
import "server-only";
/** O helper mora em catalog-digest.ts; a linha 123 usa daqui e a API publica segue exportada abaixo. */
import { sha256Hex } from "./catalog-digest";
import {
  EXTENSION_TO_MIME,
  describeFormatRejection,
  extensionOf,
  isTextExtractableExtension,
} from "@/lib/knowledge/format-contract";
import { DocumentExtractionService } from "@/lib/knowledge/services/extraction.service";
import type {
  CatalogSourceInput,
  CatalogSourceProvenance,
  CatalogValidatedSource,
  CatalogValidationIssue,
  SourceValidationCode,
} from "../types/catalog-ingestion";

/** Markers inserted by the capture itself (docs/24 section E, note 1). */
export const PAGE_MARKER_RE = /^={4,6} PAGE (\d+) ={4,6}[ \t]*$/gm;

export function isoNow(): string { return new Date().toISOString(); }

/**
 * O hash mudou de casa na FASE 5: mora em catalog-digest.ts, modulo puro que o contrato
 * de aprovacao consegue usar sem importar extrator de documento. O re-export preserve a
 * API desta arquivo - o teste da FASE 4 e o agente seguem importando sha256Hex daqui, e
 * analysedTextSha256 sai byte a byte igual ao que a FASE 4 ja gravava.
 */
export { sha256Hex } from "./catalog-digest";

export function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}'\-/]*/gu);
  return matches ? matches.length : 0;
}

export function pageMarkersOf(text: string): number[] {
  const pages: number[] = [];
  for (const match of text.matchAll(PAGE_MARKER_RE)) pages.push(Number(match[1]));
  return pages;
}

function issue(
  code: SourceValidationCode,
  severity: CatalogValidationIssue["severity"],
  message: string,
  detail?: Record<string, string | number | boolean>
): CatalogValidationIssue {
  return { code, severity, message, detail };
}

/**
 * The archive copy is the accepted provenance in FASE 4. Any other host would
 * imply a fetch, which this phase refuses by design.
 */
export function isArchiveHost(url: string): boolean {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url.trim());
  if (!match) return false;
  const authority = match[1].toLowerCase().replace(/:[0-9]+$/, "");
  const host = authority.includes("@")
    ? authority.slice(authority.lastIndexOf("@") + 1)
    : authority;
  return host === "web.archive.org" || host.endsWith(".archive.org");
}

function formatOf(input: CatalogSourceInput): string {
  if (input.fileName) {
    const ext = extensionOf(input.fileName);
    if (ext) return ext;
  }
  if (input.mimeType) {
    for (const entry of Object.entries(EXTENSION_TO_MIME)) {
      if (entry[1] === input.mimeType) return entry[0];
    }
    if (input.mimeType.startsWith("text/")) return "txt";
  }
  return "txt";
}
export interface BytesExtractionOutcome {
  text: string;
  pageCount: number;
  errorCode?: string;
}

async function textFromBytes(
  input: CatalogSourceInput,
  format: string
): Promise<BytesExtractionOutcome> {
  const mime = input.mimeType ?? EXTENSION_TO_MIME[format] ?? "text/plain";
  const buffer = Buffer.from(input.bytes ?? new Uint8Array());
  try {
    const extracted = await DocumentExtractionService.extract(buffer, mime, format);
    return { text: extracted.text, pageCount: extracted.pageCount ?? 0 };
  } catch (error: unknown) {
    const code =
      error !== null && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "EXTRACTION_FAILED";
    return { text: "", pageCount: 0, errorCode: code };
  }
}

function provenanceOf(
  input: CatalogSourceInput,
  text: string,
  format: string,
  pageCount: number
): CatalogSourceProvenance {
  return {
    kind: input.kind,
    label: input.label,
    url: input.url,
    capture: input.capture,
    declaredSha256: input.declaredSha256,
    analysedTextSha256: sha256Hex(text),
    extractor: input.extractor,
    format,
    mimeType: input.mimeType,
    fileName: input.fileName,
    pageCount,
    characters: text.length,
    words: countWords(text),
    capturedAt: input.capturedAt,
    reviewedByHuman: input.reviewedByHuman === true,
    notes: input.notes,
    pageMarkerFormat: "===== PAGE n =====",
  };
}

/**
 * Validates a source without leaving the process: no fetch, no database, no
 * disk write. Blocking issues stop the pipeline; review issues are recorded and
 * the pipeline continues, because an audit has to report instead of hide.
 */
export async function validateCatalogSource(
  input: CatalogSourceInput
): Promise<CatalogValidatedSource> {
  const issues: CatalogValidationIssue[] = [];
  const format = formatOf(input);
  let text = typeof input.text === "string" ? input.text : "";
  let pageCount = typeof input.pageCount === "number" ? input.pageCount : 0;

  if (!input.label || input.label.trim().length === 0) {
    issues.push(
      issue(
        "SOURCE_PROVENANCE_INCOMPLETE",
        "blocking",
        "Proveniencia incompleta: a fonte auditada precisa declarar um rotulo."
      )
    );
  }

  if (!input.text && !input.bytes) {
    issues.push(
      issue(
        "SOURCE_TEXT_AND_BYTES_MISSING",
        "blocking",
        "Nem texto nem bytes foram fornecidos: nao ha o que auditar."
      )
    );
  } else if (input.bytes && !input.text) {
    if (!isTextExtractableExtension(format)) {
      issues.push(
        issue(
          "SOURCE_FORMAT_UNSUPPORTED",
          "blocking",
          describeFormatRejection(input.fileName ?? "fonte." + format)
        )
      );
    } else {
      const outcome = await textFromBytes(input, format);
      if (outcome.errorCode) {
        issues.push(
          issue("SOURCE_EXTRACTION_FAILED", "blocking", "Extrator de texto recusou ou falhou no payload binario.", {
            extractorCode: outcome.errorCode,
          })
        );
      } else {
        text = outcome.text;
        pageCount = outcome.pageCount || pageCount;
      }
    }
  }

  if (input.url) {
    if (!isArchiveHost(input.url)) {
      issues.push(
        issue(
          "SOURCE_UNSAFE_PROVENANCE",
          "review",
          "URL fora do acervo arquivado: esta fase nao busca nada remoto."
        )
      );
    }
    issues.push(
      issue(
        "SOURCE_URL_NOT_FETCHED",
        "informational",
        "URL registrada como proveniencia; nenhuma requisicao foi executada."
      )
    );
  }

  if (!input.extractor) {
    issues.push(
      issue(
        "SOURCE_PROVENANCE_INCOMPLETE",
        "review",
        "Campo extractor ausente: o texto precisa dizer qual extrator o produziu."
      )
    );
  }
  if (!input.capturedAt && !input.capture) {
    issues.push(
      issue(
        "SOURCE_PROVENANCE_INCOMPLETE",
        "review",
        "Sem capturedAt nem capture: a data da captura nao e auditavel."
      )
    );
  }

  const compact = text.replace(/\u00a0/g, " ").trim();
  if (!compact) {
    issues.push(
      issue("SOURCE_EMPTY", "blocking", "A fonte nao produz texto analisavel.")
    );
  } else if (countWords(compact) < 12) {
    issues.push(
      issue(
        "SOURCE_EMPTY",
        "review",
        "Texto curto demais para segmentacao deterministica (minimo 12 palavras)."
      )
    );
  } else {
    issues.push(issue("SOURCE_OK", "informational", "Fonte aceita para auditoria."));
  }

  const ok = !issues.some((item) => item.severity === "blocking");
  return {
    ok,
    text,
    format,
    provenance: provenanceOf(
      input,
      text,
      format,
      pageCount || pageMarkersOf(text).length || 1
    ),
    issues,
    validatedAt: isoNow(),
  };
}
