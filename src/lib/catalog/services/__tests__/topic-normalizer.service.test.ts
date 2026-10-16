/**
 * FASE 4 - CatalogTopicNormalizer e os detectores de colisao.
 *
 * Os pares sao calibrados em cima das duas chaves reais do catalogo
 * (normalizeTopicName / slugifyTopic) e das linhas da tabela de docs/23 #6: se a
 *quela linha de base mudar, estes testes mudam junto e o canario avisa.
 *
 * Nenhum detector remove, funde ou descarta entrada: todo grupo devolve
 * deduplicated false e discardedEntries 0, e o conjunto de candidatos continua
 * inteiro na saida. Isso e contrato, nao intencao.
 *
 * Literais acentuados usam escape \u para o arquivo ficar byte-exato
 * independentemente da codepage do terminal que o gerou.
 */
import { describe, expect, it } from "vitest";
import { normalizeTopicName, slugifyTopic } from "@/lib/knowledge/services/topic-resolver.service";
import {
  buildReducedKey,
  canonicalKeyView,
  classifyCollision,
  findCatalogKeyAgreements,
  findCollisions,
  findReducedKeyVariants,
  findSlugCollisions,
  findTopicNameCollisions,
  normalizeTopic,
  normalizeTopics,
  ordinalTokensOf,
  type CanonicalTopicRow,
  type TopicKeyView,
} from "../topic-normalizer.service";
import type { CatalogNormalizedTopic, CatalogTopicCandidateInput, TopicOrigin } from "@/lib/catalog/types/catalog-ingestion";
function candidate(rawName: string, overrides: Partial<CatalogTopicCandidateInput> = {}): CatalogTopicCandidateInput {
  return {
    candidateId: "CAND-" + rawName.length + "-" + rawName.slice(0, 6).replace(/\s/g, ""),
    rawName,
    origin: "PUBLISHED_LABEL" as TopicOrigin,
    derivationRule: "TESTE",
    positionTitle: "Soldado BM Temp. Combatente",
    disciplineName: "L\u00edngua Portuguesa",
    start: 0,
    end: rawName.length,
    excerpt: rawName,
    ...overrides,
  };
}
function view(raw: string, id: string): TopicKeyView {
  const topic = normalizeTopic(candidate(raw, { candidateId: id }));
  return {
    id,
    rawName: topic.rawName,
    normalizedName: topic.normalizedName,
    slug: topic.slug,
    reducedKey: topic.reducedKey,
    ordinalTokens: topic.ordinalTokens,
  };
}
describe("normalizeTopic - reuso do normalizador protegido", () => {
  it("usa normalizeTopicName e slugifyTopic sem reimplementar", () => {
    const raw = "Proposicoes, conectivos.";
    const topic = normalizeTopic(candidate(raw));
    expect(topic.normalizedName).toBe(normalizeTopicName(raw));
    expect(topic.slug).toBe(slugifyTopic(raw));
    expect(topic.reducedKey).toBe(buildReducedKey(normalizeTopicName(raw)));
  });
  it("devolve um resultado por entrada, na mesma ordem, sem deduplicar", () => {
    const inputs = [candidate("Pontuacao"), candidate("Pontuacao"), candidate("Sintaxe")];
    const out = normalizeTopics(inputs);
    expect(out).toHaveLength(3);
    expect(out.map((item) => item.rawName)).toEqual(inputs.map((item) => item.rawName));
    expect(out.filter((item) => item.normalizedName === "pontuacao")).toHaveLength(2);
  });
  it("colapsa ordinal simbolico e letra o na mesma chave reduzida", () => {
    const topics = normalizeTopics([candidate("Equacao do 1\u00ba grau"), candidate("Equacao do 1 grau")]);
    expect(topics).toHaveLength(2);
    expect(topics[0]?.reducedKey).toBe("equacao do 1 grau");
    expect(topics[1]?.reducedKey).toBe("equacao do 1 grau");
    expect(topics[0]?.normalizedName).not.toBe(topics[1]?.normalizedName);
    expect(topics[0]?.slug).toBe(topics[1]?.slug);
  });
  it("registra os ordinais como publicados", () => {
    expect(ordinalTokensOf("Ensino de 2\u00ba grau")).toEqual(["2\u00ba"]);
    expect(ordinalTokensOf("Ensino de 2 o grau")).toEqual(["2 o"]);
    expect(ordinalTokensOf("Ensino de 2o grau")).toEqual(["2o"]);
  });
  it("preserva origem, regra e offset na saida normalizada", () => {
    const topic = normalizeTopic(candidate("Pontuacao", { origin: "DERIVED", derivationRule: "TERM-SEPARATOR", start: 10, end: 19, parentLabel: "Fon\u00e9tica" }));
    expect(topic.origin).toBe("DERIVED");
    expect(topic.derivationRule).toBe("TERM-SEPARATOR");
    expect(topic.start).toBe(10);
    expect(topic.parentLabel).toBe("Fon\u00e9tica");
  });
});
describe("buildReducedKey - apenas diagnostico", () => {
  it("colapsa as duas variantes de ordinal e o ampersand editorial", () => {
    expect(buildReducedKey("equacao do 1\u00ba grau")).toBe("equacao do 1 grau");
    expect(buildReducedKey("equacao do 1o grau")).toBe("equacao do 1 grau");
    expect(buildReducedKey("morfologia & sintaxe")).toBe("morfologia e sintaxe");
    expect(buildReducedKey("morfologia  e  sintaxe")).toBe("morfologia e sintaxe");
  });
  it("nao inventa nome vazio nem preserva pontuacao", () => {
    expect(buildReducedKey("")).toBe("");
    expect(buildReducedKey("...!!!")).toBe("");
    expect(buildReducedKey(normalizeTopicName("Leis de Morgan (2\u00aa edi\u00e7\u00e3o)"))).toBe(
      "leis de morgan 2 edicao"
    );
  });
});
describe("classifyCollision - precedencia diagnostica", () => {
  it("distingue texto cru, acento e pontuacao", () => {
    expect(classifyCollision(view("Trigonometria", "a"), view("Trigonometria", "b"))).toBe("NORMALIZED_NAME");
    expect(classifyCollision(view("Pontuacao", "a"), view("Pontua\u00e7\u00e3o", "b"))).toBe("CASE_OR_ACCENT_ONLY");
    expect(classifyCollision(view("Leis de Morgan", "a"), view("leis de morgan", "b"))).toBe("CASE_OR_ACCENT_ONLY");
    expect(classifyCollision(view("Razoes, proporcoes", "a"), view("Razoes proporcoes", "b"))).toBe("PUNCTUATION_ONLY");
  });
  it("nao rotula de pontuacao o que tambem mudou o acento", () => {
    expect(classifyCollision(view("Pontuacao", "a"), view("Pontua\u00e7\u00e3o.", "b"))).toBe("NORMALIZED_NAME");
    expect(classifyCollision(view("Concordancia Nominal", "a"), view("Concord\u00e2ncia, Nominal", "b"))).toBe("NORMALIZED_NAME");
  });
  it("separa divergencia de ordinal de mera variante de chave", () => {
    expect(classifyCollision(view("Equacao do 1\u00ba grau", "a"), view("Equacao do 1 grau", "b"))).toBe("ORDINAL_KEY_DIVERGENCE");
    expect(classifyCollision(view("Morfologia & Sintaxe", "c"), view("Morfologia e Sintaxe", "d"))).toBe("REDUCED_KEY_VARIANT");
  });
  it("a linha de docs/23 #6: & sai do slug mas nao do nome normatizado", () => {
    expect(classifyCollision(view("Morfologia & Sintaxe", "c"), view("Morfologia Sintaxe", "d"))).toBe("SLUG");
  });
  it("devolve null quando nada colide", () => {
    expect(classifyCollision(view("Teorema de Pitagoras", "a"), view("Trigonometria", "b"))).toBeNull();
  });
});
describe("detectores de colisao - nunca descartam entrada", () => {
  const topics: CatalogNormalizedTopic[] = normalizeTopics([
    candidate("Raciocinio Logico", { candidateId: "C1" }),
    candidate("Racioc\u00ednio L\u00f3gico", { candidateId: "C2" }),
    candidate("Equacao do 1\u00ba grau", { candidateId: "C3" }),
    candidate("Equacao do 1 grau", { candidateId: "C4" }),
    candidate("Morfologia & Sintaxe", { candidateId: "C5" }),
    candidate("Morfologia Sintaxe", { candidateId: "C6" }),
    candidate("Morfologia e Sintaxe", { candidateId: "C7" }),
    candidate("Trigonometria", { candidateId: "C8" }),
  ]);
  it("agrupa nomes identicos depois de normalizar", () => {
    const collisions = findTopicNameCollisions(topics);
    expect(collisions.map((item) => item.kind)).toEqual(["NORMALIZED_NAME", "CASE_OR_ACCENT_ONLY"]);
    expect(collisions[0]?.candidateIds).toEqual(["C1", "C2"]);
    expect(collisions[0]?.normalizedNameAgrees).toBe(true);
    expect(collisions[0]?.severity).toBe("review");
    expect(collisions[1]?.collisionId).toBe("COL-CASE_OR_ACCENT_ONLY-raciocinio-logico-01");
  });
  it("enxerga slug igual entre nomes diferentes", () => {
    const collisions = findSlugCollisions(topics);
    expect(collisions.map((item) => item.candidateIds)).toEqual([["C3", "C4"], ["C5", "C6"]]);
    expect(collisions.every((item) => item.kind === "SLUG")).toBe(true);
    expect(collisions.every((item) => item.slugAgrees)).toBe(true);
    expect(collisions.every((item) => item.normalizedNameAgrees)).toBe(false);
  });
  it("expoe divergencia de ordinal e variante de chave reduzida", () => {
    const collisions = findReducedKeyVariants(topics);
    expect(collisions.map((item) => item.kind)).toEqual(["ORDINAL_KEY_DIVERGENCE", "REDUCED_KEY_VARIANT"]);
    expect(collisions[0]?.candidateIds).toEqual(["C3", "C4"]);
    expect(collisions[0]?.severity).toBe("review");
    expect(collisions[1]?.candidateIds).toEqual(["C5", "C7"]);
    expect(collisions[1]?.reducedKeyAgrees).toBe(true);
    expect(collisions[1]?.slugAgrees).toBe(false);
    expect(collisions[1]?.severity).toBe("informational");
  });
  it("enumera tudo sem perder candidato", () => {
    const all = findCollisions(topics);
    expect(all).toHaveLength(6);
    const touched = new Set(all.flatMap((item) => item.candidateIds));
    expect(touched.size).toBe(7);
    expect(touched.has("C8")).toBe(false);
    for (const item of all) {
      expect(item.deduplicated).toBe(false);
      expect(item.discardedEntries).toBe(0);
      expect(item.message.length).toBeGreaterThan(0);
      expect(item.candidateIds.length).toBeGreaterThanOrEqual(2);
    }
    expect(topics).toHaveLength(8);
  });
  it("da id unico e repetivel a cada grupo", () => {
    const ids = findCollisions(topics).map((item) => item.collisionId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(findCollisions(topics).map((item) => item.collisionId));
  });

  it("so incrementa a sequencia quando o mesmo tipo reaparece na mesma chave", () => {
    const groups = normalizeTopics([
      candidate("Raciocinio Logico", { candidateId: "D1" }),
      candidate("Raciocinio Logico", { candidateId: "D2" }),
      candidate("Pontuacao", { candidateId: "D3" }),
      candidate("Pontuacao", { candidateId: "D4" }),
    ]);
    expect(findTopicNameCollisions(groups).map((item) => item.collisionId)).toEqual([
      "COL-NORMALIZED_NAME-pontuacao-01",
      "COL-NORMALIZED_NAME-raciocinio-logico-01",
    ]);
  });
});
describe("findCatalogKeyAgreements - candidato contra linha canonica", () => {
  const canonical: CanonicalTopicRow[] = [
    { id: "TOPICO-1", name: "Equa\u00e7\u00e3o do 1\u00ba grau", slug: "equacao-do-1-grau" },
    { id: "TOPICO-2", name: "Trigonometria", slug: "trigonometria" },
  ];
  it("revela o risco de inserir duplicata que a resolucao exata nao ve", () => {
    const topics = normalizeTopics([candidate("Equacao do 1 grau", { candidateId: "C1" })]);
    const agreements = findCatalogKeyAgreements(topics, canonical);
    expect(agreements).toHaveLength(1);
    expect(agreements[0]?.kind).toBe("ORDINAL_KEY_DIVERGENCE");
    expect(agreements[0]?.candidateIds).toEqual(["C1", "TOPICO-1"]);
    expect(agreements[0]?.deduplicated).toBe(false);
    expect(agreements[0]?.discardedEntries).toBe(0);
  });
  it("nao gera ruido quando o nome canonico e diferente de fato", () => {
    const topics = normalizeTopics([candidate("Analise combinatoria", { candidateId: "C1" })]);
    expect(findCatalogKeyAgreements(topics, canonical)).toEqual([]);
  });
  it("usa o mesmo trio de chaves para linha canonica", () => {
    const views = canonicalKeyView(canonical);
    expect(views[0]?.reducedKey).toBe("equacao do 1 grau");
    expect(views[1]?.normalizedName).toBe(normalizeTopicName("Trigonometria"));
  });
});