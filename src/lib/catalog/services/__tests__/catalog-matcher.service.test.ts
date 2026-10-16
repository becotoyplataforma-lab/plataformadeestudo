/**
 * Contrato de assunto do CatalogMatcher: quem resolve, em que ordem, e onde para.
 *
 * Nada aqui toca banco ou disco. O catalogo canonico e sintetico e montado por
 * loadCatalogSnapshot com as mesmas colunas do snapshot de leitura-only, para que
 * as regras sejam testadas sem depender do arquivo gerado em disco.
 *
 * O que este arquivo fixa (docs/23 #4 e docs/27 #2 e #4):
 *  - alias do caller vence o vocabulario declarado em codigo;
 *  - alias so vale se o alvo existe no snapshot: alias nao inventa catalogo;
 *  - alias resolve assunto e nunca renomeia linha canonica;
 *  - cabecalho sem alvo continua SUBJ-03 / BLOQUEADO;
 *  - unidade sem disciplina e SUBJ-00 / PENDENTE_REVISAO, porque falta
 *    proveniencia (o conflict service trata como PROVENANCE_MISSING), nao materia;
 *  - assunto inativo existe, e por isso bloqueia (TOPIC-07) ate quando o alias o
 *    aponta: resolver assunto nao e autorizar escrita;
 *  - countByClassification devolve sempre as cinco chaves.
 */
import { describe, expect, it } from "vitest";
import { normalizeTopicName } from "@/lib/knowledge/services/topic-resolver.service";
import { countByClassification, matchTopics } from "../catalog-matcher.service";
import {
  CATALOG_SNAPSHOT_KIND,
  loadCatalogSnapshot,
  type CatalogSnapshotView,
} from "../catalog-snapshot.service";
import {
  CANONICAL_SUBJECT_ALIASES,
  UNMAPPED_PUBLISHED_SUBJECTS,
} from "../catalog-subject-vocabulary";
import { normalizeTopics } from "../topic-normalizer.service";
import type {
  CatalogSubjectAlias,
  CatalogTopicCandidateInput,
  CatalogTopicMatch,
  TopicOrigin,
} from "../../types/catalog-ingestion";
const SUBJECT_SEEDS = [
  { id: "subject-portugues", name: "Português", slug: "portugues", status: "active" },
  { id: "subject-gramatica", name: "Gramática", slug: "gramatica", status: "active" },
  { id: "subject-raciocinio", name: "Raciocínio Lógico", slug: "raciocinio-logico", status: "active" },
  { id: "subject-extinta", name: "Legislação Extinta", slug: "legislacao-extinta", status: "inactive" },
];
const TOPIC_SEEDS = [
  { id: "topic-semanticas", subjectId: "subject-portugues", name: "Semântica", slug: "semanticas" },
  { id: "topic-pontuacao", subjectId: "subject-portugues", name: "Pontuação", slug: "pontuacao" },
  { id: "topic-regencia", subjectId: "subject-gramatica", name: "Sintaxe de Regência", slug: "sintaxe-de-regencia" },
];
function snapshotView(): CatalogSnapshotView {
  return loadCatalogSnapshot({
    kind: CATALOG_SNAPSHOT_KIND,
    schema_version: 1,
    generated_at: "2026-10-03T00:00:00.000Z",
    checksum_sha256: "b".repeat(64),
    seed_compatible: false,
    destructive: false,
    data: {
      knowledge_subjects: SUBJECT_SEEDS.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.status,
        deleted_at: null,
      })),
      knowledge_topics: TOPIC_SEEDS.map((row) => ({
        id: row.id,
        subject_id: row.subjectId,
        parent_topic_id: null,
        name: row.name,
        slug: row.slug,
        status: "active",
        deleted_at: null,
      })),
    },
    analysis: {
      knowledge_topics_per_subject: SUBJECT_SEEDS.map((row) => {
        const total = TOPIC_SEEDS.filter((topic) => topic.subjectId === row.id).length;
        return {
          knowledge_subject_id: row.id,
          name: row.name,
          slug: row.slug,
          status: row.status,
          live: row.status === "active",
          topics_total: total,
          topics_live: total,
          topics_with_parent: 0,
        };
      }),
    },
  });
}
function candidate(disciplineName: string, rawName: string, origin: TopicOrigin = "PUBLISHED_LABEL"): CatalogTopicCandidateInput {
  return {
    candidateId: "CAND-" + rawName.length + "-" + disciplineName.length,
    rawName,
    origin,
    derivationRule: "teste de contrato",
    positionTitle: "Soldado BM Temp. C",
    disciplineName,
    page: 22,
    start: 0,
    end: rawName.length,
    excerpt: rawName,
  };
}
function matchOne(options: {
  disciplineName: string;
  rawName: string;
  origin?: TopicOrigin;
  subjectAliases?: CatalogSubjectAlias[];
  view?: CatalogSnapshotView;
}): CatalogTopicMatch {
  const view = options.view ?? snapshotView();
  const topics = normalizeTopics([candidate(options.disciplineName, options.rawName, options.origin)]);
  const matches = matchTopics({ topics, view, subjectAliases: options.subjectAliases });
  const row = matches[0];
  if (!row) throw new Error("matcher nao devolveu linha");
  return row;
}
function sameName(a: string, b: string): boolean {
  return normalizeTopicName(a) === normalizeTopicName(b);
}
function topicRow(id: string, subjectId: string, name: string, slug: string) {
  return { id, subject_id: subjectId, parent_topic_id: null, name, slug, status: "active", deleted_at: null };
}
/** Snapshot com topicos extras: serve para forzar chave canonica duplicada. */
function viewWithTopics(extra: Array<{ id: string; name: string; slug: string }>): CatalogSnapshotView {
  const rows = TOPIC_SEEDS.map((row) => topicRow(row.id, row.subjectId, row.name, row.slug));
  for (const item of extra) {
    rows.push(topicRow(item.id, "subject-portugues", item.name, item.slug));
  }
  return loadCatalogSnapshot({
    kind: CATALOG_SNAPSHOT_KIND,
    schema_version: 1,
    generated_at: "2026-10-03T00:00:00.000Z",
    checksum_sha256: "c".repeat(64),
    seed_compatible: false,
    destructive: false,
    data: {
      knowledge_subjects: SUBJECT_SEEDS.map((row) => ({ id: row.id, name: row.name, slug: row.slug, status: row.status, deleted_at: null })),
      knowledge_topics: rows,
    },
    analysis: {
      knowledge_topics_per_subject: SUBJECT_SEEDS.map((row) => {
        const total = rows.filter((topic) => topic.subject_id === row.id).length;
        return { knowledge_subject_id: row.id, name: row.name, slug: row.slug, status: row.status, live: row.status === "active", topics_total: total, topics_live: total, topics_with_parent: 0 };
      }),
    },
  });
}
describe("SUBJ-01: cabecalho publicado ja e assunto canonico", () => {
  it("Raciocinio Logico casa sem alias e termina em TOPIC-05 porque nao tem topicos", () => {
    const row = matchOne({ disciplineName: "Raciocínio Lógico", rawName: "Lógica de proposições" });
    expect(row.ruleApplied).toBe("TOPIC-05");
    expect(row.classification).toBe("NOVO_CANONICO");
    expect(row.canonicalSubjectName).toBe("Raciocínio Lógico");
    expect(row.subjectAliasApplied).toBe(false);
    expect(row.proposedAsNewCanonical).toBe(true);
    expect(row.canonicalTopicId).toBeNull();
  });
});
describe("SUBJ-02: alias de assunto", () => {
  it("vocabulario em codigo resolve Lingua Portuguesa para o nome canonico do snapshot", () => {
    const row = matchOne({ disciplineName: "Língua Portuguesa", rawName: "Semântica" });
    expect(row.ruleApplied).toBe("TOPIC-01");
    expect(row.classification).toBe("REUSO_CANONICO");
    expect(row.canonicalSubjectName).toBe("Português");
    expect(row.canonicalSubjectId).toBe("subject-portugues");
    expect(row.canonicalTopicId).toBe("topic-semanticas");
    expect(row.subjectAliasApplied).toBe(true);
    expect(row.resolutionMethod).toBe("exact");
  });
  it("alias do caller tem precedencia sobre o vocabulario em codigo", () => {
    const row = matchOne({
      disciplineName: "Língua Portuguesa",
      rawName: "Sintaxe de Regência",
      subjectAliases: [{ publishedName: "Língua Portuguesa", canonicalSubjectName: "Gramática", rule: "edital decide mais especifico que o vocabulario geral" }],
    });
    expect(row.canonicalSubjectId).toBe("subject-gramatica");
    expect(row.canonicalSubjectName).toBe("Gramática");
    expect(row.classification).toBe("REUSO_CANONICO");
    expect(row.subjectAliasApplied).toBe(true);
  });
  it("alias de caller sem alvo no snapshot nao bloqueia: cede ao vocabulario", () => {
    const row = matchOne({
      disciplineName: "Língua Portuguesa",
      rawName: "Pontuação",
      subjectAliases: [{ publishedName: "Língua Portuguesa", canonicalSubjectName: "Teoria Inexistente", rule: "alvo nao existe no snapshot" }],
    });
    expect(row.canonicalSubjectName).toBe("Português");
    expect(row.classification).toBe("REUSO_CANONICO");
    expect(row.subjectAliasApplied).toBe(true);
  });
  it("resolver assunto por alias nao autoriza linha inativa: TOPIC-07 bloqueia", () => {
    const row = matchOne({
      disciplineName: "Conhecimentos Específicos",
      rawName: "Código de Ética",
      subjectAliases: [{ publishedName: "Conhecimentos Específicos", canonicalSubjectName: "Legislação Extinta", rule: "alvo existe mas esta inativo" }],
    });
    expect(row.ruleApplied).toBe("TOPIC-07");
    expect(row.classification).toBe("BLOQUEADO");
    expect(row.subjectAliasApplied).toBe(true);
    expect(row.canonicalSubjectName).toBe("Legislação Extinta");
    expect(row.canonicalTopicId).toBeNull();
  });
  it("a comparacao nao depende de acento nem de caixa", () => {
    const row = matchOne({ disciplineName: "lingua portuguesa", rawName: "semantica" });
    expect(row.canonicalSubjectName).toBe("Português");
    expect(row.classification).toBe("REUSO_CANONICO");
  });
  it("alias nao renomeia linha canonica nem inventa assunto", () => {
    const view = snapshotView();
    const before = view.subjects.map((subject) => subject.name);
    const row = matchOne({ disciplineName: "Língua Portuguesa", rawName: "Semântica", view });
    expect(row.rawName).toBe("Semântica");
    expect(row.disciplineName).toBe("Língua Portuguesa");
    expect(view.subjects.map((subject) => subject.name)).toEqual(before);
    expect(before).toContain("Português");
    expect(before).not.toContain("Língua Portuguesa");
  });
});
describe("SUBJ-00 e SUBJ-03: onde o matcher para", () => {
  it("unidade sem disciplina publicada nao bloqueia: falta de proveniencia", () => {
    const row = matchOne({ disciplineName: "", rawName: "Semântica" });
    expect(row.ruleApplied).toBe("SUBJ-00");
    expect(row.classification).toBe("PENDENTE_REVISAO");
    expect(row.canonicalSubjectId).toBeNull();
    expect(row.canonicalTopicId).toBeNull();
  });
  it("cabecalho sem alvo canônico fica SUBJ-03 / BLOQUEADO e nao ganha alias", () => {
    const row = matchOne({ disciplineName: "Conhecimentos Específicos", rawName: "Código de Ética" });
    expect(row.ruleApplied).toBe("SUBJ-03");
    expect(row.classification).toBe("BLOQUEADO");
    expect(row.subjectAliasApplied).toBe(false);
    expect(row.canonicalSubjectId).toBeNull();
    expect(row.canonicalTopicId).toBeNull();
    expect(row.proposedAsNewCanonical).toBe(false);
  });
});
describe("TOPIC-03 e TOPIC-06", () => {
  it("duas linhas canonicas pela mesma chave sao ambiguas, nunca escolhidas", () => {
    const row = matchOne({
      disciplineName: "Português",
      rawName: "Semântica",
      view: viewWithTopics([{ id: "topic-semanticas-bis", name: "SEMÂNTICA", slug: "semanticas" }]),
    });
    expect(row.ruleApplied).toBe("TOPIC-03");
    expect(row.classification).toBe("AMBIGUO");
    expect(row.ambiguousCanonicalIds).toContain("topic-semanticas");
    expect(row.ambiguousCanonicalIds).toContain("topic-semanticas-bis");
    expect(row.canonicalTopicId).toBeNull();
  });
  it("nome DERIVED sem correspondencia e revisao humana, nao novidade canonica", () => {
    const row = matchOne({
      disciplineName: "Língua Portuguesa",
      rawName: "emprego de palavras desconhecidas no texto",
      origin: "DERIVED",
    });
    expect(row.ruleApplied).toBe("TOPIC-06");
    expect(row.classification).toBe("PENDENTE_REVISAO");
    expect(row.proposedAsNewCanonical).toBe(false);
    expect(Array.isArray(row.nearMissCanonicalIds)).toBe(true);
  });
});
describe("vocabulario declarado em codigo", () => {
  it("reproduz docs/23 #4 sem inventar quarta linha", () => {
    expect(CANONICAL_SUBJECT_ALIASES).toHaveLength(2);
    expect(sameName(CANONICAL_SUBJECT_ALIASES[0]!.publishedName, "Língua Portuguesa")).toBe(true);
    expect(sameName(CANONICAL_SUBJECT_ALIASES[0]!.canonicalSubjectName, "Português")).toBe(true);
    expect(sameName(CANONICAL_SUBJECT_ALIASES[1]!.publishedName, "Matemática e Raciocínio Lógico")).toBe(true);
    expect(sameName(CANONICAL_SUBJECT_ALIASES[1]!.canonicalSubjectName, "Matemática")).toBe(true);
    for (const alias of CANONICAL_SUBJECT_ALIASES) {
      expect(alias.rule.length).toBeGreaterThan(0);
    }
  });
  it("cabeçalhos sem alvo estao registrados e nenhum deles tem alias", () => {
    expect(UNMAPPED_PUBLISHED_SUBJECTS.some((name) => sameName(name, "Conhecimentos Específicos"))).toBe(true);
    expect(UNMAPPED_PUBLISHED_SUBJECTS.some((name) => sameName(name, "Conhecimentos Básicos"))).toBe(true);
    for (const published of UNMAPPED_PUBLISHED_SUBJECTS) {
      expect(CANONICAL_SUBJECT_ALIASES.some((alias) => sameName(alias.publishedName, published))).toBe(false);
    }
  });
});
describe("countByClassification", () => {
  it("devolve as cinco chaves mesmo sem nenhuma linha", () => {
    expect(countByClassification([])).toEqual({
      REUSO_CANONICO: 0,
      NOVO_CANONICO: 0,
      AMBIGUO: 0,
      BLOQUEADO: 0,
      PENDENTE_REVISAO: 0,
    });
  });
  it("fecha a contagem sobre o mesmo conjunto que a medicao do edital", () => {
    const view = snapshotView();
    const topics = normalizeTopics([
      candidate("Língua Portuguesa", "Semântica"),
      candidate("Raciocínio Lógico", "Lógica de proposições"),
      candidate("Conhecimentos Específicos", "Código de Ética"),
      candidate("", "Pontuação"),
      candidate("Língua Portuguesa", "emprego de palavras desconhecidas", "DERIVED"),
    ]);
    const matches = matchTopics({ topics, view });
    expect(matches).toHaveLength(5);
    expect(countByClassification(matches)).toEqual({
      REUSO_CANONICO: 1,
      NOVO_CANONICO: 1,
      AMBIGUO: 0,
      BLOQUEADO: 1,
      PENDENTE_REVISAO: 2,
    });
  });
});