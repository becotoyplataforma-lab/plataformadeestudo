/**
 * CatalogRequestMapper (FASE 4B) - traduz a borda do pedido para os tipos da FASE 4.
 *
 * O pedido conceitual (§4: source/contest/mode) nao cria um segundo vocabulario: ele
 * e mapeado para `CatalogSourceInput` e `CatalogAuditRequest`, que continuam sendo a
 * fonte da verdade. Modo APPLY entra aqui apenas para virar registro de recusa nos
 * flags de bypass; ele nao habilita caminho de escrita nenhum.
 *
 * Regras de borda:
 *  - `text` vai como texto ja extraido (inline-text);
 *  - `pdf` e `document` vao como bytes base64 (local-file) e o contrato de formato
 *    decide o que pode virar texto; binario sem extrator continua recusado;
 *  - `url` nao e buscada: a URL e registrada como proveniencia e, sem payload, a
 *    auditoria recusa a fonte. Rede continua fora desta fase.
 *  - base64 invalido produz fonte vazia, e o validador da FASE 4 devolve a recusa
 *    bloqueante. Nenhum erro e engolido nem reescrito aqui.
 */
import "server-only";
import type {
  CatalogAgentMode,
  CatalogAgentRequest,
  CatalogAgentSourceInput,
  CatalogAgentSourceType,
} from "../types/catalog-agent";
import type {
  CatalogAuditRequest,
  CatalogSourceInput,
  CatalogSourceKind,
} from "../types/catalog-ingestion";

const BASE64_BODY_RE = /^[A-Za-z0-9+/\r\n]+={0,2}$/;

/** Tipo da borda -> kind ja definido na FASE 4. Sem kind novo. */
export function sourceKindOf(type: CatalogAgentSourceType): CatalogSourceKind {
  if (type === "text") return "inline-text";
  if (type === "url") return "archived-document";
  return "local-file";
}

export function decodeBase64Content(content: string): Uint8Array | null {
  const compact = content.replace(/\s+/g, "");
  if (compact.length === 0 || !BASE64_BODY_RE.test(compact)) return null;
  try {
    const decoded = Buffer.from(compact, "base64");
    if (decoded.length === 0) return null;
    // Buffer.from nao valida o alfabeto: re-codificar e a unica prova de ida e volta.
    if (decoded.toString("base64").replace(/\s+/g, "") !== compact) return null;
    return new Uint8Array(decoded);
  } catch {
    return null;
  }
}

export interface CatalogSourceMapping {
  requestedType: CatalogAgentSourceType;
  kind: CatalogSourceKind;
  /** True quando o payload virou bytes decodificaveis. */
  decodedBytes: boolean;
  contentCharacters: number;
  /** Nota curta para o humano; nunca um texto do provedor nem do disco. */
  note: string;
}

export interface MappedCatalogSource {
  input: CatalogSourceInput;
  mapping: CatalogSourceMapping;
}

export function toCatalogSourceInput(source: CatalogAgentSourceInput): MappedCatalogSource {
  const kind = sourceKindOf(source.type);
  const label = source.label ?? source.name ?? "";
  const base: CatalogSourceInput = {
    kind,
    label,
    url: source.url,
    capture: source.capture,
    declaredSha256: source.declaredSha256,
    fileName: source.name,
    mimeType: source.mimeType,
    extractor: source.extractor,
    capturedAt: source.capturedAt,
    pageCount: source.pageCount,
    reviewedByHuman: source.reviewedByHuman,
    notes: source.notes,
  };

  if (kind === "inline-text") {
    return {
      input: { ...base, text: source.content },
      mapping: {
        requestedType: source.type,
        kind,
        decodedBytes: false,
        contentCharacters: source.content.length,
        note: "Texto enviado como payload ja extraido.",
      },
    };
  }

  if (kind === "archived-document") {
    // Sem texto nao ha o que auditar, e assim mesmo que deve ficar: a fase nao busca.
    return {
      input: { ...base, text: source.content.length > 0 ? source.content : undefined },
      mapping: {
        requestedType: source.type,
        kind,
        decodedBytes: false,
        contentCharacters: source.content.length,
        note:
          source.content.length > 0
            ? "Payload declarado junto da URL: a URL e registrada, nunca buscada."
            : "Somente URL declarada: esta fase nao busca nada remoto e a fonte sera recusada.",
      },
    };
  }

  const bytes = decodeBase64Content(source.content);
  if (bytes === null) {
    return {
      input: { ...base, text: "" },
      mapping: {
        requestedType: source.type,
        kind,
        decodedBytes: false,
        contentCharacters: source.content.length,
        note: "Conteudo nao e base64 validido: a auditoria recusa a fonte sem interpretar o payload.",
      },
    };
  }
  return {
    input: { ...base, bytes },
    mapping: {
      requestedType: source.type,
      kind,
      decodedBytes: true,
      contentCharacters: source.content.length,
      note: "Bytes decodificados; a decisao de formato pertence ao contrato de extracao da FASE 4.",
    },
  };
}

/** Modo pedido: ausente e AUDIT. */
export function requestedModeOf(mode?: CatalogAgentMode): CatalogAgentMode {
  return mode === "APPLY" ? "APPLY" : "AUDIT";
}

/**
 * APPLY vira bandeira de bypass, que `refuseCatalogApply` registra e recusa. E o
 * unico efeito possivel do modo APPLY hoje: nenhuma linha de escrita existe.
 */
export function bypassFlagsOf(mode: CatalogAgentMode): Record<string, unknown> | undefined {
  return mode === "APPLY" ? { mode: "APPLY" } : undefined;
}

export function toCatalogAuditRequest(request: CatalogAgentRequest): {
  audit: CatalogAuditRequest;
  mapping: CatalogSourceMapping;
} {
  const mapped = toCatalogSourceInput(request.source);
  const mode = requestedModeOf(request.mode);
  return {
    mapping: mapped.mapping,
    audit: {
      mode: "audit-only",
      source: mapped.input,
      extraction: request.extraction,
      subjectAliases: request.subjectAliases,
      ai: request.ai,
      bypass: bypassFlagsOf(mode),
    },
  };
}