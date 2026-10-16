/**
 * POST /api/admin/catalog/analyze - CourseCatalogAgent em AUDIT (admin).
 *
 * NAO e duplicata de /api/admin/editais/parse: aquela rota extrai materias e topicos
 * via IA para o cadastro do edital e alimenta /api/admin/editais/apply, que escreve
 * em notice_subjects/notice_topics. Esta rota roda o agente de catalogo: normaliza,
 * casa contra o snapshot de leitura-only, detecta colisoes e devolve uma PROPOSTA
 * auditavel com relatorio humano. Nenhum caminho daqui escreve no banco: applyStatus e
 * sempre BLOCKED nesta fase, e a unica leitura de catalogo e o snapshot de leitura-only. O
 * guard de sessao e o de toda rota admin (leitura do usuario logado, sem escrita).
 *
 * DeepSeek so e chamado se o caller pedir ai=true E houver DEEPSEEK_API_KEY; sem
 * chave a secao de IA fica AI_CLIENT_UNAVAILABLE e a decisao deterministica segue
 * identica. URL de fonte nunca e buscada.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import {
  AdminGuardService,
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import { CourseCatalogAgent } from "@/lib/catalog/agents/course-catalog-agent";
import { createDeepSeekCatalogAiClient } from "@/lib/catalog/services/deepseek-catalog-ai-client";
import type { CatalogAgentRequest } from "@/lib/catalog/types/catalog-agent";

const SourceSchema = z.object({
  type: z.enum(["pdf", "text", "url", "document"]),
  content: z.string().min(1, "content vazio: nao ha o que auditar"),
  name: z.string().max(240).optional(),
  label: z.string().max(240).optional(),
  url: z.string().url().optional(),
  capture: z.string().max(64).optional(),
  declaredSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "sha256 declarado precisa ter 64 hex")
    .optional(),
  mimeType: z.string().max(120).optional(),
  extractor: z.string().max(120).optional(),
  capturedAt: z.string().max(64).optional(),
  pageCount: z.number().int().min(0).optional(),
  reviewedByHuman: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

const ContestSchema = z.object({
  name: z.string().max(200).optional(),
  board: z.string().max(200).optional(),
  organ: z.string().max(200).optional(),
  position: z.string().max(200).optional(),
  level: z.string().max(120).optional(),
});

const ExtractionSchema = z.object({
  disciplineVocabulary: z.array(z.string().max(200)).max(200).optional(),
  positionTitles: z.array(z.string().max(300)).max(100).optional(),
  labelVocabulary: z.array(z.string().max(200)).max(400).optional(),
  includeDerivedTerms: z.boolean().optional(),
});

const AliasSchema = z.object({
  publishedName: z.string().min(1).max(200),
  canonicalSubjectName: z.string().min(1).max(200),
  rule: z.string().min(3).max(400),
});

const AnalyzeSchema = z.object({
  source: SourceSchema,
  contest: ContestSchema.optional(),
  mode: z.enum(["AUDIT", "APPLY"]).default("AUDIT"),
  extraction: ExtractionSchema.optional(),
  subjectAliases: z.array(AliasSchema).max(200).optional(),
  ai: z.boolean().optional(),
  maxAiCandidates: z.number().int().min(0).max(300).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const body = await request.json().catch(() => null);
    const parsed = AnalyzeSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const agentRequest: CatalogAgentRequest = {
      source: parsed.data.source,
      contest: parsed.data.contest,
      mode: parsed.data.mode,
      extraction: parsed.data.extraction,
      subjectAliases: parsed.data.subjectAliases,
      // O contrato de IA e o da FASE 4: proposta anotada, sem autoridade nenhuma.
      ai:
        parsed.data.ai === true
          ? {
              enabled: true,
              provider: "deepseek",
              maxCandidates: parsed.data.maxAiCandidates,
            }
          : { enabled: false },
    };

    const agent = new CourseCatalogAgent({
      aiClient: parsed.data.ai === true ? createDeepSeekCatalogAiClient() : null,
    });
    const analysis = await agent.analyze(agentRequest);

    // Fonte recusada continua sendo resposta de auditoria, com o motivo: o admin
    // precisa ler a recusa, nao receber um 500 sem explicacao.
    const blocking = analysis.audit.validation.find((item) => item.severity === "blocking");
    if (blocking) {
      return NextResponse.json(
        {
          status: "SOURCE_REFUSED",
          applyStatus: analysis.applyStatus,
          validation: analysis.audit.validation,
          sourceMapping: analysis.sourceMapping,
          blockingIssue: blocking,
          report: analysis.report,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      status: "AUDIT_COMPLETE",
      mode: analysis.mode,
      requestedMode: analysis.requestedMode,
      applyStatus: analysis.applyStatus,
      proposal: {
        source: analysis.source,
        contest: analysis.contest,
        subjects: analysis.subjects,
        topics: analysis.topics,
        collisions: analysis.collisions,
        aiProposal: analysis.aiProposal,
        conflicts: analysis.conflicts,
        summary: analysis.summary,
      },
      applyRefusal: {
        code: analysis.apply.code,
        message: analysis.apply.message,
        databaseOperations: analysis.apply.databaseOperations,
        refusedBypassFlags: analysis.apply.refusedBypassFlags,
      },
      report: analysis.report,
    });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/catalog/analyze] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao auditar o edital contra o catálogo." },
      { status: 500 }
    );
  }
}