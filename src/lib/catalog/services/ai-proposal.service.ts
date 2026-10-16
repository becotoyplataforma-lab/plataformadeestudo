/**
 * CatalogAiProposalService (FASE 4) - camada de anotacao, sem autoridade.
 *
 * O unico produto desta camada e CatalogAiProposal: sugestao rotulada, guardada
 * ao lado da decisao deterministica. A classificacao do matcher nunca e reescrita
 * por saida de modelo. O provedor e INJETADO: este modulo nao importa fabrica de
 * IA, nao usa fetch global e nao le variavel de ambiente de chave. Em auditoria o
 * caller passa um stub deterministico (ou nenhum cliente), entao teste nenhum faz
 * rede.
 */
import "server-only";
import { z } from "zod";
import type {
  CatalogAiProposal,
  CatalogAiProposalRequest,
  CatalogAiRejection,
  CatalogAiSection,
  CatalogNormalizedTopic,
} from "../types/catalog-ingestion";
import type { CatalogSnapshotView } from "./catalog-snapshot.service";

/** Autoridade da IA no pipeline: nenhuma, sempre. */
export const CATALOG_AI_AUTHORITY = "none";
export const CATALOG_AI_ROLE = "AI_PROPOSAL";
export const CATALOG_AI_DEFAULT_MAX_CANDIDATES = 40;

export interface CatalogAiPrompt {
  system: string;
  user: string;
  maxTokens: number;
}

export interface CatalogAiClient {
  readonly provider: "deepseek";
  readonly model: string;
  complete(prompt: CatalogAiPrompt): Promise<string>;
}

/**
 * Chaves que denotam vontade de decidir ou escrever. Se aparecerem na resposta, o
 * conteudo e descartado e apenas o nome do campo fica registrado: nunca o payload
 * bruto, que pode trazer id de banco, caminho ou credencial.
 */
export const FORBIDDEN_RESPONSE_KEYS = [
  "action",
  "actions",
  "write",
  "writes",
  "insert",
  "create",
  "update",
  "delete",
  "apply",
  "commit",
  "persist",
  "sql",
  "query",
  "database",
  "migration",
  "migrate",
  "seed",
  "classification",
];

const RawProposalSchema = z
  .object({
    candidate_index: z.number().int().min(0).optional(),
    candidate_id: z.string().min(1).max(200).optional(),
    suggested_canonical_topic_id: z.string().min(1).max(200).nullable().optional(),
    justification: z.string().min(3).max(600),
    confidence: z.number().min(0).max(1),
  })
  .passthrough();

const RawProposalListSchema = z.object({ proposals: z.array(RawProposalSchema).max(300) }).passthrough();

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (typeof value === "object" && value !== null) return Object.keys(value);
  return [];
}

/** Campos proibidos na resposta do provedor (IA querendo decidir ou escrever). */
export function detectOverreachKeys(payload: unknown): string[] {
  const lowered = keysOf(payload).map((key) => key.toLowerCase());
  return Array.from(new Set(lowered)).filter((key) => FORBIDDEN_RESPONSE_KEYS.includes(key));
}

/** Prompt deterministico: ids e nomes publicados, sem dado pessoal e sem caminho. */
export function buildCatalogAiPrompt(
  candidates: CatalogNormalizedTopic[],
  view: CatalogSnapshotView
): CatalogAiPrompt {
  const topicLines = view.topics
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((topic) => topic.id + " | " + topic.name + " | assunto " + topic.subjectId);
  const candidateLines = candidates.map(
    (candidate, index) => index + " | " + candidate.candidateId + " | " + candidate.disciplineName + " | " + candidate.rawName
  );
  return {
    system:
      "Voce e um anotador de catalogo. Responda apenas JSON no formato " +
      "{proposals:[{candidate_index,suggested_canonical_topic_id,justification,confidence}]}. " +
      "Nunca decida classificacao, nunca peca escrita, nunca invente id fora da lista.",
    user:
      "TOPICOS CANONICOS (id | nome | assunto):\n" +
      topicLines.join("\n") +
      "\n\nCANDIDATOS (index | candidate_id | disciplina | nome publicado):\n" +
      candidateLines.join("\n"),
    maxTokens: 2048,
  };
}

function sectionOf(input: {
  enabled: boolean;
  provider: CatalogAiSection["provider"];
  model: string;
  proposals: CatalogAiProposal[];
  rejections: CatalogAiRejection[];
  candidatesSent: number;
  skippedReason?: string;
  timingsMs: { request: number; validate: number };
}): CatalogAiSection {
  return {
    enabled: input.enabled,
    role: CATALOG_AI_ROLE,
    authority: CATALOG_AI_AUTHORITY,
    provider: input.provider,
    model: input.model,
    proposals: input.proposals,
    rejections: input.rejections,
    candidatesSent: input.candidatesSent,
    skippedReason: input.skippedReason,
    timingsMs: input.timingsMs,
  };
}

export interface CatalogAiRequestInput {
  candidates: CatalogNormalizedTopic[];
  view: CatalogSnapshotView;
  request?: CatalogAiProposalRequest;
  client?: CatalogAiClient | null;
  now?: () => string;
}

/**
 * Unica porta da IA no agente. Devolve propostas validadas e as recusas (codigo,
 * candidato e nome do campo ofensor). Nunca devolve texto cru do provedor.
 */
export async function requestCatalogAiProposals(
  input: CatalogAiRequestInput
): Promise<CatalogAiSection> {
  const now = input.now ?? (() => new Date().toISOString());
  const model = input.request?.model ?? input.client?.model ?? "";
  if (input.request?.enabled !== true) {
    return sectionOf({
      enabled: false,
      provider: "none",
      model,
      proposals: [],
      rejections: [],
      candidatesSent: 0,
      skippedReason: "AI_NOT_REQUESTED",
      timingsMs: { request: 0, validate: 0 },
    });
  }
  const client = input.client;
  if (!client) {
    return sectionOf({
      enabled: true,
      provider: input.request.provider ?? "deepseek",
      model,
      proposals: [],
      rejections: [],
      candidatesSent: 0,
      skippedReason: "AI_CLIENT_UNAVAILABLE",
      timingsMs: { request: 0, validate: 0 },
    });
  }

  const cap = Math.max(0, input.request.maxCandidates ?? CATALOG_AI_DEFAULT_MAX_CANDIDATES);
  const ordered = input.candidates
    .slice()
    .sort((a, b) => a.candidateId.localeCompare(b.candidateId))
    .slice(0, cap);
  const base = {
    enabled: true,
    provider: client.provider as "deepseek",
    model: client.model,
    proposals: [] as CatalogAiProposal[],
    rejections: [] as CatalogAiRejection[],
    candidatesSent: ordered.length,
    timingsMs: { request: 0, validate: 0 },
  };
  if (ordered.length === 0) {
    return sectionOf({ ...base, skippedReason: "AI_NO_CANDIDATES" });
  }

  const rejections: CatalogAiRejection[] = [];
  const proposals: CatalogAiProposal[] = [];
  const requestedAt = now();
  const requestStart = Date.now();
  let raw: string;
  try {
    raw = await client.complete(buildCatalogAiPrompt(ordered, input.view));
  } catch {
    return sectionOf({
      ...base,
      proposals,
      rejections: [
        { code: "AI_PROVIDER_FAILED", message: "O provedor nao respondeu; nenhuma sugestao entrou no relatorio." },
      ],
      timingsMs: { request: Date.now() - requestStart, validate: 0 },
    });
  }
  const requestMs = Date.now() - requestStart;
  const validateStart = Date.now();
  const timings = () => ({ request: requestMs, validate: Date.now() - validateStart });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return sectionOf({
      ...base,
      rejections: [{ code: "AI_SCHEMA_INVALID", message: "Resposta do provedor nao e JSON; conteudo descartado." }],
      timingsMs: timings(),
    });
  }

  const overreach = detectOverreachKeys(parsed);
  if (overreach.length !== 0) {
    return sectionOf({
      ...base,
      rejections: overreach.map((field) => ({
        code: "AI_OVERREACH" as const,
        message: "A resposta traz campo que expressa decisao ou escrita; conteudo inteiro descartado.",
        offendingField: field,
      })),
      timingsMs: timings(),
    });
  }

  const list = RawProposalListSchema.safeParse(parsed);
  if (!list.success) {
    const issue = list.error.issues[0];
    return sectionOf({
      ...base,
      rejections: [
        {
          code: "AI_SCHEMA_INVALID",
          message: "Estrutura da resposta fora do contrato; sugestoes descartadas.",
          offendingField: issue ? issue.path.join(".") : undefined,
        },
      ],
      timingsMs: timings(),
    });
  }

  const topicsById = new Map(input.view.topics.map((topic) => [topic.id, topic]));
  list.data.proposals.forEach((proposal, index) => {
    const byId = proposal.candidate_id
      ? ordered.find((item) => item.candidateId === proposal.candidate_id)
      : undefined;
    const byIndex = proposal.candidate_index === undefined ? undefined : ordered[proposal.candidate_index];
    const candidate = byId ?? byIndex;
    if (!candidate) {
      rejections.push({
        code: "INVALID_AI_PROPOSAL",
        message: "Proposta sem candidato correspondente na lista enviada.",
        offendingField: proposal.candidate_id ? "candidate_id" : "candidate_index",
      });
      return;
    }
    const suggestedId = proposal.suggested_canonical_topic_id ?? null;
    if (suggestedId !== null && !topicsById.has(suggestedId)) {
      rejections.push({
        code: "INVALID_AI_PROPOSAL",
        message: "Id de topico canonico inexistente no snapshot de leitura-only.",
        candidateId: candidate.candidateId,
        offendingField: "suggested_canonical_topic_id",
      });
      return;
    }
    proposals.push({
      proposalId: "AIP-" + candidate.candidateId + "-" + String(index + 1).padStart(2, "0"),
      candidateId: candidate.candidateId,
      rawName: candidate.rawName,
      suggestedCanonicalTopicId: suggestedId,
      justification: proposal.justification,
      confidence: proposal.confidence,
      provider: client.provider,
      model: client.model,
      requestedAt,
    });
  });

  return sectionOf({ ...base, proposals, rejections, timingsMs: timings() });
}
