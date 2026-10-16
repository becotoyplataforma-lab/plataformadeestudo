/**
 * ConcursoAI - FASE 2D: colisoes de normalizacao do catalogo (caracterizacao).
 *
 * As duas chaves puras do pipeline de topicos (normalizeTopicName e slugifyTopic) nao
 * concordam entre si, e as restricoes de unicidade das tabelas usam chaves diferentes:
 *
 *   notice_topics       -> uq_notice_topics_subject_norm (notice_subject_id, normalized_name)
 *   knowledge_topics    -> uq_knowledge_topics_slug_subject (subject_id, slug)
 *   knowledge_subjects  -> uq_knowledge_subjects_name (nome BRUTO) e uq_knowledge_subjects_slug
 *
 * Consequencia: uma mesma lista pode passar na validacao do edital e violar o catalogo
 * pedagogico, ou ser deduplicada em memoria sem nenhum registro do descarte.
 *
 * A lista NOTICE_TOPICS_2026 abaixo NAO e ficticia: sao os 12 nomes reais de
 * notice_topics gravados no banco, copidos do snapshot somente leitura
 * database/knowledge/snapshots/2026-10-03-catalogo-atual.json (FASE 2D). O mesmo vale para
 * KNOWLEDGE_TOPICS_PORTUGUES, os 13 nomes reais de knowledge_topics da materia Portugues.
 *
 * Nada aqui altera comportamento de producao. Os canarios usam it.fails e devem
 * permanecer como falha esperada ate que exista um canal real de diagnostico de colisao.
 *
 * Literais acentuados sao gravados com escape \u para o arquivo ficar byte-exato
 * independentemente da codepage do terminal que o gerou.
 */
import { describe, it, expect } from "vitest";
import * as topicResolverModule from "../topic-resolver.service";
import { normalizeTopicName, slugifyTopic } from "../topic-resolver.service";

/** Os 12 notice_topics reais da linha de base (edital CBMERJ SMTV 2026). */
const NOTICE_TOPICS_2026 = [
  "Pontua\u00e7\u00e3o (Uso da v\u00edrgula, dois-pontos, etc.)",
  "Reg\u00eancia Nominal e Verbal e Uso do Sinal de Crase",
  "Morfologia (Classes de palavras e flex\u00f5es)",
  "Concord\u00e2ncia Nominal e Verbal",
  "Compreens\u00e3o e Interpreta\u00e7\u00e3o de Textos (G\u00eaneros variados, coes\u00e3o e coer\u00eancia)",
  "Sintaxe (Estrutura da ora\u00e7\u00e3o, per\u00edodo simples e composto)",
  "Sem\u00e2ntica (Sin\u00f4nimos, ant\u00f4nimos, conota\u00e7\u00e3o e denota\u00e7\u00e3o)",
  "Geometria Plana (C\u00e1lculo de \u00e1reas e per\u00edmetros de figuras b\u00e1sicas)",
  "\u00c1lgebra (Equa\u00e7\u00f5es de 1\u00ba e 2\u00ba graus, sistemas e fun\u00e7\u00f5es)",
  "Raz\u00e3o e Propor\u00e7\u00e3o (Regra de tr\u00eas simples/composta, porcentagem e juros simples)",
  "An\u00e1lise Combinat\u00f3ria e Probabilidade (Princ\u00edpio multiplicativo, arranjos e combina\u00e7\u00f5es)",
  "Aritm\u00e9tica B\u00e1sica (Opera\u00e7\u00f5es com n\u00fameros reais, fra\u00e7\u00f5es e decimais)",
];

/** Os 13 knowledge_topics reais da materia Portugues na mesma linha de base. */
const KNOWLEDGE_TOPICS_PORTUGUES = [
  "Interpreta\u00e7\u00e3o de Texto",
  "Coes\u00e3o e Coer\u00eancia",
  "Sem\u00e2ntica",
  "Fonologia e Ortografia",
  "Reg\u00eancia e Crase",
  "Morfologia (Classes de Palavras)",
  "Sintaxe do Per\u00edodo",
  "Acentua\u00e7\u00e3o Gr\u00e1fica",
  "Tipologia Textual",
  "Figuras de Linguagem",
  "Sintaxe da Ora\u00e7\u00e3o",
  "Concord\u00e2ncia Verbal e Nominal",
  "Pontua\u00e7\u00e3o",
];

const TOPICOS_PORTUGUES_DO_EDITAL = NOTICE_TOPICS_2026.slice(0, 7);
const TOPICOS_MATHEMATICA_DO_EDITAL = NOTICE_TOPICS_2026.slice(7);

describe("FASE 2D / colisoes de normalizacao (caracterizacao)", () => {
  it("A1: grafia com pontuacao colide com a grafia limpa e a funcao nao da nenhum sinal", () => {
    const oficial = "Classes de Palavras";
    const comPonto = "Classes de palavras!";

    expect(normalizeTopicName(oficial)).toBe("classes de palavras");
    expect(normalizeTopicName(comPonto)).toBe(normalizeTopicName(oficial));
    expect(slugifyTopic(comPonto)).toBe(slugifyTopic(oficial));
    expect(normalizeTopicName(comPonto)).not.toContain("!");
  });

  it("A2: acento, maiusculas e espacos colapsam na mesma chave (duplicata invisivel)", () => {
    const variantes = ["Crase", "  CR\u00c1SE  ", "crase.", "CRASE"];
    const chaves = variantes.map(normalizeTopicName);

    expect(new Set(chaves).size).toBe(1);
    expect(chaves[0]).toBe("crase");
  });

  it("B1: o & sobrevive em normalized_name mas colapsa em slug (as duas chaves discordam)", () => {
    const comEcomercial = "Morfologia & Sintaxe";
    const semEcomercial = "Morfologia Sintaxe";

    // normalized_name DIFERENTE: notice_topics aceita os dois na mesma materia.
    expect(normalizeTopicName(comEcomercial)).toBe("morfologia & sintaxe");
    expect(normalizeTopicName(semEcomercial)).toBe("morfologia sintaxe");

    // slug IGUAL: knowledge_topics rejeita o segundo por uq_knowledge_topics_slug_subject.
    expect(slugifyTopic(comEcomercial)).toBe("morfologia-sintaxe");
    expect(slugifyTopic(semEcomercial)).toBe(slugifyTopic(comEcomercial));
  });

  it("B2: ordinal gera tres chaves normalizadas e dois slugs para um unico conceito", () => {
    const comOrdinal = "Equa\u00e7\u00e3o do 2\u00ba Grau";
    const semOrdinal = "Equa\u00e7\u00e3o do 2 Grau";
    const comLetraO = "Equa\u00e7\u00e3o do 2o Grau";

    // O ordinal nao e decomposto por NFD: permanece na chave normalizada, entao as tres
    // grafias viram tres topicos distintos para notice_topics.
    expect(normalizeTopicName(comOrdinal)).not.toBe(normalizeTopicName(semOrdinal));
    expect(normalizeTopicName(comOrdinal)).not.toBe(normalizeTopicName(comLetraO));
    expect(normalizeTopicName(semOrdinal)).not.toBe(normalizeTopicName(comLetraO));

    // O slug colapsa ordinal e ausencia de ordinal no mesmo valor, mas a letra o gera
    // slug diferente: duas grafias viram um topico e a terceira vira outro.
    expect(slugifyTopic(comOrdinal)).toBe(slugifyTopic(semOrdinal));
    expect(slugifyTopic(comOrdinal)).not.toBe(slugifyTopic(comLetraO));
  });

  it("B3: materia usa nome bruto, entao case e acento criam materias novas em vez de colidir", () => {
    const canonico = "Portugu\u00eas";
    const semAcento = "portugues";

    expect(canonico).not.toBe(semAcento);
    expect(normalizeTopicName(canonico)).toBe(normalizeTopicName(semAcento));
    expect(slugifyTopic(canonico)).toBe(slugifyTopic(semAcento));
  });

  it("C1: conteudo historico sem acento colide com o catalogo atual (risco direto da FASE 3)", () => {
    const atual = "Sem\u00e2ntica";
    const historico2021 = "Semantica";

    expect(normalizeTopicName(atual)).toBe(normalizeTopicName(historico2021));
    expect(slugifyTopic(atual)).toBe(slugifyTopic(historico2021));

    for (const nome of ["Ortografia", "Classes de Palavras"]) {
      expect(normalizeTopicName(nome)).toBe(normalizeTopicName(nome.toLowerCase()));
    }
  });

  it("C2: proximidade semantica nao colide: os dois topicos vao coexistir sem alerta", () => {
    const atual2026 = "Interpreta\u00e7\u00e3o e Compreens\u00e3o de Texto";
    const historico2021 = "Interpreta\u00e7\u00e3o de Texto";

    expect(normalizeTopicName(atual2026)).not.toBe(normalizeTopicName(historico2021));
    expect(slugifyTopic(atual2026)).not.toBe(slugifyTopic(historico2021));
  });

  it("D1: linha de base preservada - os 12 topicos reais do edital nao colidem entre si", () => {
    expect(NOTICE_TOPICS_2026).toHaveLength(12);

    const chaves = NOTICE_TOPICS_2026.map(normalizeTopicName);
    expect(new Set(chaves).size).toBe(12);

    const slugs = NOTICE_TOPICS_2026.map(slugifyTopic);
    expect(new Set(slugs).size).toBe(12);
    expect(chaves.every((c) => c.length > 0)).toBe(true);
    expect(slugs.every((s) => /^[a-z0-9\-]+$/.test(s))).toBe(true);
  });

  it("D2: linha de base preservada - 7 de Portugues e 5 de Matematica (nao 6 mais 6)", () => {
    expect(TOPICOS_PORTUGUES_DO_EDITAL).toHaveLength(7);
    expect(TOPICOS_MATHEMATICA_DO_EDITAL).toHaveLength(5);

    // As duas materias de edital existem no knowledge_catalog, mas so Portugues tem
    // topicos pedagogicos: Matematica tem zero linhas em knowledge_topics.
    expect(KNOWLEDGE_TOPICS_PORTUGUES).toHaveLength(13);
    expect(NOTICE_TOPICS_2026).toHaveLength(12);
  });

  it("F1: divergencia ja presente na linha viva - o ordinal do edital some no slug", () => {
    // Linha real de notice_topics do edital CBMERJ SMTV 2026 (snapshot FASE 2D).
    const real = "\u00c1lgebra (Equa\u00e7\u00f5es de 1\u00ba e 2\u00ba graus, sistemas e fun\u00e7\u00f5es)";

    // normalized_name conserva os ordinais (e assim entra na unicidade de notice_topics).
    expect(normalizeTopicName(real)).toContain("1\u00ba");
    expect(normalizeTopicName(real)).toContain("2\u00ba");

    // slug perde os ordinais: Algebra de 1 grau e Algebra de 2 graus colidiriam aqui.
    expect(slugifyTopic(real)).toBe("algebra-equacoes-de-1-e-2-graus-sistemas-e-funcoes");
    expect(slugifyTopic(real)).not.toContain("1\u00ba");
  });

  it("F2: hoje nenhum topico do edital e resolvido deterministicamente contra o catalogo", () => {
    const chavesCatalogo = new Set(KNOWLEDGE_TOPICS_PORTUGUES.map(normalizeTopicName));
    const slugsCatalogo = new Set(KNOWLEDGE_TOPICS_PORTUGUES.map(slugifyTopic));

    const resolvidos = TOPICOS_PORTUGUES_DO_EDITAL.filter((nome) => {
      return chavesCatalogo.has(normalizeTopicName(nome)) || slugsCatalogo.has(slugifyTopic(nome));
    });

    // Casos semanticamente obvios (Morfologia, Sintaxe, Concordancia, Pontuacao,
    // Semantica) continuam sem correspondencia porque o edital escreve o conteudo
    // entre parenteses. A FASE 3 precisa de tabela de mapeamento explicita.
    expect(resolvidos).toHaveLength(0);
  });

  it.fails("E1 (falha esperada): a camada de normalizacao deve expor deteccao de colisao", async () => {
    const exports = Object.keys(topicResolverModule);
    expect(exports).toContain("findTopicNameCollisions");
    expect(exports).toContain("findSlugCollisions");
  });

  it.fails("E2 (falha esperada): slug deve ser round-trip com normalized_name", async () => {
    const entrada = "Morfologia & Sintaxe";
    expect(normalizeTopicName(slugifyTopic(entrada))).toBe(normalizeTopicName(entrada));
  });
});

