import { describe, it, expect } from "vitest";
import {
  normalizeTopicName,
  slugifyTopic,
  resolveTopicInMemory,
  type TopicCandidate,
} from "../topic-resolver.service";

describe("TopicResolverService — Resolução Determinística de Tópicos", () => {
  const SUBJECT_PORTUGUES = "11111111-1111-4000-8000-111111111111";
  const SUBJECT_DIREITO = "22222222-2222-4000-8000-222222222222";

  const MOCK_TOPICS: TopicCandidate[] = [
    {
      id: "topic-crase-id",
      subjectId: SUBJECT_PORTUGUES,
      name: "Crase",
      slug: "crase",
    },
    {
      id: "topic-pontuacao-id",
      subjectId: SUBJECT_PORTUGUES,
      name: "Pontuação e Vírgula",
      slug: "pontuacao-e-virgula",
    },
    {
      id: "topic-concordancia-id",
      subjectId: SUBJECT_PORTUGUES,
      name: "Concordância Verbal e Nominal",
      slug: "concordancia-verbal-e-nominal",
    },
    {
      id: "topic-morfologia-id",
      subjectId: SUBJECT_PORTUGUES,
      name: "Classes de Palavras e Morfossintaxe",
      slug: "morfologia",
    },
    {
      id: "topic-atos-id",
      subjectId: SUBJECT_DIREITO,
      name: "Atos Administrativos",
      slug: "atos-administrativos",
    },
    // Casos de colisão/ambiguidade intencional para testes de segurança
    {
      id: "topic-ambig-1",
      subjectId: SUBJECT_PORTUGUES,
      name: "Sintaxe",
      slug: "sintaxe-geral",
    },
    {
      id: "topic-ambig-2",
      subjectId: SUBJECT_PORTUGUES,
      name: "Sintaxe",
      slug: "sintaxe-avancada",
    },
  ];

  describe("1. Normalização de Nomes e Slugs", () => {
    it("trata variações de maiúsculas, minúsculas e acentos de forma idêntica (Crase, crase, CRASE)", () => {
      expect(normalizeTopicName("Crase")).toBe("crase");
      expect(normalizeTopicName("crase")).toBe("crase");
      expect(normalizeTopicName("CRASE")).toBe("crase");
      expect(normalizeTopicName("  CRÁSE  ")).toBe("crase");
      expect(normalizeTopicName("cráse")).toBe("crase");
    });

    it("trata pontuação, espaços múltiplos e caracteres especiais", () => {
      expect(normalizeTopicName("Pontuação e  Vírgula.")).toBe("pontuacao e virgula");
      expect(normalizeTopicName("Atos - Administrativos (Geral)")).toBe("atos administrativos geral");
      expect(slugifyTopic("Pontuação e Vírgula!")).toBe("pontuacao-e-virgula");
      expect(slugifyTopic("Concordância Verbal & Nominal")).toBe("concordancia-verbal-nominal");
    });

    it("lida seguramente com valores nulos ou vazios", () => {
      expect(normalizeTopicName(null)).toBe("");
      expect(normalizeTopicName(undefined)).toBe("");
      expect(normalizeTopicName("   ")).toBe("");
      expect(slugifyTopic(null)).toBe("");
      expect(slugifyTopic("")).toBe("");
    });
  });

  describe("2. Match Exato Normalizado", () => {
    it("resolve com sucesso variações case-insensitive e sem acentos de 'Crase'", () => {
      const res1 = resolveTopicInMemory(
        { topicName: "CRASE", subjectId: SUBJECT_PORTUGUES },
        MOCK_TOPICS
      );
      expect(res1.topicId).toBe("topic-crase-id");
      expect(res1.method).toBe("exact");

      const res2 = resolveTopicInMemory(
        { topicName: "crase", subjectId: SUBJECT_PORTUGUES },
        MOCK_TOPICS
      );
      expect(res2.topicId).toBe("topic-crase-id");
      expect(res2.method).toBe("exact");
    });

    it("resolve com sucesso com pontuação e espaços extras", () => {
      const res = resolveTopicInMemory(
        { topicName: "Pontuação  e  Vírgula!", subjectId: SUBJECT_PORTUGUES },
        MOCK_TOPICS
      );
      expect(res.topicId).toBe("topic-pontuacao-id");
      expect(res.method).toBe("exact");
    });
  });

  describe("3. Match por Slug Normalizado", () => {
    it("resolve por slug quando o texto fornecido coincide com o slug do tópico", () => {
      const res = resolveTopicInMemory(
        { topicName: "morfologia", subjectId: SUBJECT_PORTUGUES },
        MOCK_TOPICS
      );
      expect(res.topicId).toBe("topic-morfologia-id");
      expect(res.method).toBe("slug");
    });
  });

  describe("4. Tópico de Outra Disciplina (Rejeição)", () => {
    it("rejeita correspondência quando o tópico existe mas pertence a outra matéria", () => {
      // 'Atos Administrativos' existe em Direito, não em Português
      const res = resolveTopicInMemory(
        { topicName: "Atos Administrativos", subjectId: SUBJECT_PORTUGUES },
        MOCK_TOPICS
      );
      expect(res.topicId).toBeNull();
      expect(res.method).toBe("none");
    });

    it("rejeita topicId explícito se ele pertencer a outra disciplina", () => {
      const res = resolveTopicInMemory(
        { topicId: "topic-atos-id", subjectId: SUBJECT_PORTUGUES },
        MOCK_TOPICS
      );
      expect(res.topicId).toBeNull();
      expect(res.method).toBe("none");
    });

    it("aceita topicId explícito se pertencer à disciplina correta", () => {
      const res = resolveTopicInMemory(
        { topicId: "topic-atos-id", subjectId: SUBJECT_DIREITO },
        MOCK_TOPICS
      );
      expect(res.topicId).toBe("topic-atos-id");
      expect(res.method).toBe("id");
    });
  });

  describe("5. Ambiguidade e Segurança", () => {
    it("retorna null quando há ambiguidade dentro da mesma matéria (múltiplos com mesmo nome)", () => {
      const res = resolveTopicInMemory(
        { topicName: "Sintaxe", subjectId: SUBJECT_PORTUGUES },
        MOCK_TOPICS
      );
      expect(res.topicId).toBeNull();
      expect(res.method).toBe("none");
    });

    it("retorna null e não falha se topicName for nulo, indefinido ou vazio (questão sem tópico)", () => {
      const res1 = resolveTopicInMemory(
        { topicName: null, subjectId: SUBJECT_PORTUGUES },
        MOCK_TOPICS
      );
      expect(res1.topicId).toBeNull();
      expect(res1.method).toBe("none");

      const res2 = resolveTopicInMemory(
        { topicName: "", subjectId: SUBJECT_PORTUGUES },
        MOCK_TOPICS
      );
      expect(res2.topicId).toBeNull();
      expect(res2.method).toBe("none");

      const res3 = resolveTopicInMemory(
        { topicName: "   ", subjectId: SUBJECT_PORTUGUES },
        MOCK_TOPICS
      );
      expect(res3.topicId).toBeNull();
      expect(res3.method).toBe("none");
    });

    it("retorna null se o nome não encontrar nenhuma correspondência (sem fuzzy match agressivo)", () => {
      const res = resolveTopicInMemory(
        { topicName: "Assunto Totalmente Inexistente no Edital", subjectId: SUBJECT_PORTUGUES },
        MOCK_TOPICS
      );
      expect(res.topicId).toBeNull();
      expect(res.method).toBe("none");
    });
  });
});
