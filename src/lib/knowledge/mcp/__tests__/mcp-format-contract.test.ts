/**
 * Trava de divergencia entre camadas.
 *
 * O plano do MCP promete que o conteudo vira texto indexavel. Essa promessa so
 * vale se o IngestionService aceitar o MIME e se o DocumentExtractionService
 * tiver extrator para ele. Os tres conjuntos sao comparados aqui com os simbolos
 * reais de cada camada: acrescentar .epub ao MCP sem escrever extrator faz este
 * teste falhar, que e exatamente o bug que corrigimos.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {},
}));
vi.mock("@/lib/billing/services/limits.resolver", () => ({
  resolveUserLimits: async () => ({ maxDocuments: 99 }),
}));
vi.mock("@/lib/knowledge/storage/backend", () => ({
  storageBackend: () => "supabase",
}));

import { ALLOWED_MIME_TYPES } from "@/lib/knowledge/services/ingestion.service";
import {
  BINARY_NO_EXTRACTOR_EXTENSIONS,
  IMAGE_EXTENSIONS,
  TEXT_EXTRACTABLE_EXTENSIONS,
  TEXT_EXTRACTABLE_MIME_TYPES,
  extensionOf,
  hasTextExtractor,
  mimeForExtension,
  textFormatOf,
} from "@/lib/knowledge/format-contract";
import {
  APOSTILA_REJECTED_EXTENSIONS,
  APOSTILA_SUPPORTED_EXTENSIONS,
  apostilaMcpProvider,
} from "../providers/apostila-mcp";

const planFor = async (fileName: string) => {
  const ext = extensionOf(fileName);
  return apostilaMcpProvider.plan({
    fileName,
    mimeType: mimeForExtension(ext) ?? "application/octet-stream",
    sizeBytes: 2048,
    sha256: "0".repeat(64),
  });
};

const PROBE_EXTENSIONS = [...TEXT_EXTRACTABLE_EXTENSIONS, ...BINARY_NO_EXTRACTOR_EXTENSIONS, ...IMAGE_EXTENSIONS, "xml"];

describe("contrato do MCP x formatos reais do pipeline", () => {
  it("aceita exatamente o conjunto que tem extrator de texto", async () => {
    const accepted: string[] = [];
    const rejected: string[] = [];
    for (const ext of PROBE_EXTENSIONS) {
      const plan = await planFor("arquivo." + ext);
      if (plan.classification === "supported") {
        accepted.push(ext);
      } else {
        rejected.push(ext);
      }
    }
    expect(accepted.sort()).toEqual([...TEXT_EXTRACTABLE_EXTENSIONS].sort());
    expect(rejected).toContain("epub");
    expect(rejected).toContain("doc");
    expect(rejected).toContain("jpg");
    expect(rejected).toContain("xml");
  });

  it("as listas publicas do provedor batem com o contrato", () => {
    const accepted = [...APOSTILA_SUPPORTED_EXTENSIONS].sort();
    expect(accepted).toEqual([...TEXT_EXTRACTABLE_EXTENSIONS].sort());
    const rejected = [...APOSTILA_REJECTED_EXTENSIONS].sort();
    const expected = [...BINARY_NO_EXTRACTOR_EXTENSIONS, ...IMAGE_EXTENSIONS].sort();
    expect(rejected).toEqual(expected);
    for (const ext of accepted) {
      expect(rejected).not.toContain(ext);
    }
  });

  it("todo MIME aceito pelo upload tem par correspondente no contrato", () => {
    const upload = [...ALLOWED_MIME_TYPES].sort();
    const contrato = [...TEXT_EXTRACTABLE_MIME_TYPES].sort();
    expect(upload).toEqual(contrato);
  });

  it("toda extensao aceita tem MIME liberado no upload e extrator no pipeline", () => {
    for (const ext of TEXT_EXTRACTABLE_EXTENSIONS) {
      const mime = mimeForExtension(ext);
      expect(mime).not.toBeNull();
      expect(new Set<string>(ALLOWED_MIME_TYPES).has(String(mime))).toBe(true);
      expect(hasTextExtractor(String(textFormatOf(ext)), String(mime))).toBe(true);
    }
  });

  it("nenhuma extensao recusada tem extrator, nem hoje nem por engano", () => {
    for (const ext of [...BINARY_NO_EXTRACTOR_EXTENSIONS, ...IMAGE_EXTENSIONS]) {
      expect(textFormatOf(ext)).toBeNull();
      expect(hasTextExtractor(ext, mimeForExtension(ext) ?? "application/octet-stream")).toBe(false);
    }
  });

  it("EPUB entra como unsupported com motivo de conversao, nao como supported", async () => {
    const plan = await planFor("apostila.epub");
    expect(plan.classification).toBe("unsupported");
    expect(plan.reason).toContain("extrator");
    expect(plan.indexedByDefault).toBe(false);
  });

  it("DOCX e HTML entram porque a extracao existe de verdade", async () => {
    for (const name of ["aula-01.docx", "aula-02.html", "aula-03.htm", "aula-04.md"]) {
      const plan = await planFor(name);
      expect(plan.classification).toBe("supported");
    }
  });
});
