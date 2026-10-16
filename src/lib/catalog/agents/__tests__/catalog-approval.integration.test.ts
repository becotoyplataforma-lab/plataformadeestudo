/**
 * Aprovacao humana sobre analises REAIS do CourseCatalogAgent (FASE 5 sobre a FASE 4B).
 *
 * O teste unitario construiu o payload a mao porque o que la importa e o contrato. Aqui e
 * o contrario: o payload sai do agente inteiro, com edital, snapshot de leitura-only e
 * cliente de IA falso injetado. O objetivo e provar que o contrato survive a forma real
 * da analise -- inclusive quando a IA entra e o relogio anda.
 *
 * Nada aqui abre banco (o catalogo vem do snapshot JSON), roda migracao, faz seed, chama
 * rede ou toca APPLY.
 */
import { describe, expect, it } from "vitest";
import { CourseCatalogAgent } from "../course-catalog-agent";
import {
  NOVO_CURSO_2026_DECLARED_CONTEST,
  NOVO_CURSO_2026_EXTRACTION,
  NOVO_CURSO_2026_SOURCE,
  NOVO_CURSO_2026_TEXT,
} from "./novo-curso-2026.fixture";
import {
  CBMERJ_2021_EXTRACTION_OPTIONS,
  CBMERJ_2021_SOURCE_LABEL,
  CBMERJ_2021_SUBJECT_ALIASES,
  CBMERJ_2021_TEXT,
} from "./cbmerj-2021.fixture";
import { fakeCatalogClient } from "./fake-catalog-client";
import type { CatalogAiClient } from "../../services/ai-proposal.service";
import {
  approvalIdOf,
  assertApprovalMatchesProposal,
  buildApprovalGate,
  decisionProjectionOf,
  findCurrentApproval,
  proposalBindingOf,
  proposalDigestOf,
  proposalIdOf,
  signApproval,
  validateApproval,
  analysisDigestOf,
} from "../../services/catalog-approval.service";
import { CATALOG_APPROVAL_SCHEMA_VERSION, type CatalogApproval, type CatalogApprovalDraft } from "../../types/catalog-approval";
import type { CatalogAgentAnalysis, CatalogAgentRequest } from "../../types/catalog-agent";

const RELOGIO = "2026-10-04T00:00:00.000Z";
const EXECUCAO_UM = "2026-10-03T08:00:00.000Z";
const EXECUCAO_DOIS = "2026-10-03T19:30:00.000Z";
const DECISAO = "2026-10-03T12:00:00.000Z";
const REVISOR = "Maria Andrade (coordenacao pedagogica)";

function relogioFixo(instante: string): () => string {
  return () => (instante);
}

async function analisar(
  request: CatalogAgentRequest,
  instante: string,
  client: CatalogAiClient | null
): Promise<CatalogAgentAnalysis> {
  const agent = new CourseCatalogAgent({ aiClient: client, now: relogioFixo(instante) });
  return agent.analyze(request);
}

function novoCursoRequest(overrides: Partial<CatalogAgentRequest>): CatalogAgentRequest {
  return {
    source: NOVO_CURSO_2026_SOURCE,
    contest: NOVO_CURSO_2026_DECLARED_CONTEST,
    mode: "AUDIT",
    extraction: NOVO_CURSO_2026_EXTRACTION,
    ai: { enabled: false },
    ...overrides,
  };
}

function cbmerjRequest(): CatalogAgentRequest {
  return {
    source: {
      type: "text",
      content: CBMERJ_2021_TEXT,
      name: "anexo-vi-cbmerj-2021.txt",
      label: CBMERJ_2021_SOURCE_LABEL,
      extractor: "docs/24 transcricao literal",
      capturedAt: "2026-10-03T00:00:00.000Z",
      reviewedByHuman: true,
    },
    mode: "AUDIT",
    extraction: CBMERJ_2021_EXTRACTION_OPTIONS,
    subjectAliases: CBMERJ_2021_SUBJECT_ALIASES,
    ai: { enabled: false },
  };
}

function draftDe(analysisValue: CatalogAgentAnalysis, patch: Partial<CatalogApprovalDraft>): CatalogApprovalDraft {
  const binding = proposalBindingOf(analysisValue);
  return {
    proposalId: binding.proposalId,
    analysisDigest: binding.analysisDigest,
    proposalDigest: binding.proposalDigest,
    status: "aprovado",
    decidedBy: REVISOR,
    decidedAt: DECISAO,
    ...patch,
  };
}

function aprovar(analysisValue: CatalogAgentAnalysis, patch: Partial<CatalogApprovalDraft>): CatalogApproval {
  return signApproval(draftDe(analysisValue, patch), { now: relogioFixo(RELOGIO) });
}
describe("aprovacao sobre payload real do agente", () => {
  it("aprova a analise inteira do novo curso", async () => {
    const analysisValue = await analisar(novoCursoRequest({}), EXECUCAO_UM, null);
    const record = aprovar(analysisValue, { note: "Catalogo confere com o anexo publicado." });
    expect(record.schemaVersion).toBe(CATALOG_APPROVAL_SCHEMA_VERSION);
    expect(record.approvalId).toBe(approvalIdOf(record));
    expect(validateApproval(record, { now: relogioFixo(RELOGIO) }).ok).toBe(true);
    const gate = buildApprovalGate(analysisValue, [record]);
    expect(gate.approved).toBe(true);
    expect(gate.status).toBe("aprovado");
    expect(gate.issues).toEqual([]);
    expect(gate.analysisDigest).toBe(analysisValue.source.analysedTextSha256);
    expect(gate.proposalId).toBe(proposalIdOf(analysisValue));
    expect(gate.proposalDigest).toBe(proposalDigestOf(analysisValue));
    expect(() => (assertApprovalMatchesProposal(analysisValue, record))).not.toThrow();
    expect(analysisValue.topics.length).toBeGreaterThan(1);
    expect(decisionProjectionOf(analysisValue).topics).toHaveLength(analysisValue.topics.length);
  });

  it("sem decisao registrada nao ha aprovacao, e isso nao e um status", async () => {
    const analysisValue = await analisar(novoCursoRequest({}), EXECUCAO_UM, null);
    const busca = findCurrentApproval(proposalIdOf(analysisValue), []);
    expect(busca.found).toBe(false);
    expect(busca.chain).toEqual([]);
    const gate = buildApprovalGate(analysisValue, []);
    expect(gate.approved).toBe(false);
    expect(gate.status).toBeNull();
    expect(gate.issues.map((item) => (item.code))).toEqual(["APPROVAL_MISSING"]);
  });

  it("rejeicao tambem e decisao vigente", async () => {
    const analysisValue = await analisar(novoCursoRequest({}), EXECUCAO_UM, null);
    const rejeitado = aprovar(analysisValue, { status: "rejeitado" });
    const gate = buildApprovalGate(analysisValue, [rejeitado]);
    expect(gate.approved).toBe(false);
    expect(gate.status).toBe("rejeitado");
    expect(gate.issues.map((item) => (item.code))).toContain("APPROVAL_REJECTED");
  });

  it("a corregao da decisao vira registro novo, sem apagar o anterior", async () => {
    const analysisValue = await analisar(novoCursoRequest({}), EXECUCAO_UM, null);
    const aprovado = aprovar(analysisValue, {});
    const rejeitado = aprovar(analysisValue, {
      status: "rejeitado",
      decidedBy: "Joao Pereira (revisao)",
      supersedesApprovalId: aprovado.approvalId,
    });
    const busca = findCurrentApproval(aprovado.proposalId, [rejeitado, aprovado]);
    expect(busca.chain.map((item) => (item.approvalId))).toEqual([aprovado.approvalId, rejeitado.approvalId]);
    expect(busca.approval?.status).toBe("rejeitado");
    const gate = buildApprovalGate(analysisValue, [rejeitado, aprovado]);
    expect(gate.approved).toBe(false);
    expect(gate.approval?.approvalId).toBe(rejeitado.approvalId);
  });

  it("reexecutar com IA e com outro relogio nao invalida a decisao humana", async () => {
    const semIa = await analisar(novoCursoRequest({}), EXECUCAO_UM, null);
    const record = aprovar(semIa, {});
    const comIa = await analisar(
      novoCursoRequest({ ai: { enabled: true, provider: "deepseek", model: "fake-deepseek-catalog", maxCandidates: 20 } }),
      EXECUCAO_DOIS,
      fakeCatalogClient(0.6)
    );
    expect(comIa.aiProposal.enabled).toBe(true);
    expect(comIa.aiProposal.provider).toBe("deepseek");
    expect(semIa.aiProposal.enabled).toBe(false);
    expect(comIa.audit.startedAt).not.toBe(semIa.audit.startedAt);
    expect(analysisDigestOf(comIa)).toBe(analysisDigestOf(semIa));
    expect(proposalIdOf(comIa)).toBe(proposalIdOf(semIa));
    expect(proposalDigestOf(comIa)).toBe(record.proposalDigest);
    expect(decisionProjectionOf(comIa).summary.conflicts).toBe(decisionProjectionOf(semIa).summary.conflicts);
    expect(buildApprovalGate(comIa, [record]).approved).toBe(true);
  });

  it("mudar a fonte muda o digest e desfaz o vinculo", async () => {
    const base = await analisar(novoCursoRequest({}), EXECUCAO_UM, null);
    const record = aprovar(base, {});
    const textoExtra = NOVO_CURSO_2026_TEXT + "\nLegislacao Municipal: linha nova publicada.\n";
    const modificado = await analisar(
      novoCursoRequest({ source: { ...NOVO_CURSO_2026_SOURCE, content: textoExtra } }),
      EXECUCAO_UM,
      null
    );
    expect(analysisDigestOf(modificado)).not.toBe(analysisDigestOf(base));
    expect(proposalIdOf(modificado)).not.toBe(proposalIdOf(base));
    const gate = buildApprovalGate(modificado, [record]);
    expect(gate.approved).toBe(false);
    expect(gate.issues.map((item) => (item.code))).toContain("ANALYSIS_DIGEST_MISMATCH");
  });

  it("adulterar a classificacao depois da assinatura rompe a proposta", async () => {
    const analysisValue = await analisar(novoCursoRequest({}), EXECUCAO_UM, null);
    const record = aprovar(analysisValue, {});
    const alvo = analysisValue.topics.find((item) => (item.classification === "NOVO_CANONICO"));
    if (alvo === undefined) throw new Error("fixture mudou");
    alvo.classification = "REUSO_CANONICO";
    expect(proposalDigestOf(analysisValue)).not.toBe(record.proposalDigest);
    const gate = buildApprovalGate(analysisValue, [record]);
    expect(gate.approved).toBe(false);
    expect(gate.issues.map((item) => (item.code))).toContain("PROPOSAL_DIGEST_MISMATCH");
    expect(() => (assertApprovalMatchesProposal(analysisValue, record))).toThrow();
  });

  it("o gate nao produz efeito de escrita no edital grande", async () => {
    const analysisValue = await analisar(cbmerjRequest(), EXECUCAO_UM, null);
    expect(analysisValue.topics.length).toBeGreaterThan(10);
    const record = aprovar(analysisValue, {});
    const antes = JSON.stringify(analysisValue);
    const gate = buildApprovalGate(analysisValue, [record]);
    expect(JSON.stringify(analysisValue)).toBe(antes);
    expect(gate.approved).toBe(true);
    expect(gate.approval?.approvalId).toBe(record.approvalId);
    expect("apply" in gate).toBe(false);
    expect("databaseOperations" in gate).toBe(false);
    expect(analysisValue.apply.applied).toBe(false);
    expect(analysisValue.summary.applyAllowed).toBe(false);
  });
});