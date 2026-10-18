/**
 * Pipeline de transformacao de apostila: PII, estrutura, modos e fallback.
 *
 * O que estes testes protegem, na pratica:
 *  - dado pessoal sai, autoria fica;
 *  - `sanitize-only` nao toca a rede;
 *  - IA que perde questao ou apaga a plataforma nao e indexada;
 *  - IA que falha nao bloqueia upload: o documento cai no caminho offline.
 */
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ApostilaTransformerService,
  isTransformDisabled,
} from "../apostila-transformer.service";
import { ApostilaSanitizerService, isCpfValid } from "../apostila-sanitizer.service";
import { ApostilaStructurerService, countQuestions } from "../apostila-structurer.service";
import { ApostilaTransformReportSchema, type ApostilaStructuringClient } from "../../dto/apostila-transform.dto";
import { compiledApostilaRules } from "../../config/apostila-rules.schema";

const CPF_VALIDO = "111.444.777-35";
const CPF_EXEMPLO_DE_AULA = "123.456.789-00";

const APOSTILA = [
  "Estratégia Concursos - Apostila de Direito Constitucional",
 "Professor João Auditor - Aula 01",
  "Material disponivel em www.estrategia.com.br/materiais",
  "",
  "Fase 01 - Teoria dos direitos fundamentais",
  "Regra: os direitos fundamentais podem ser restringidos por lei.",
  "Atencao: o artigo 5 inciso 77 cai em toda prova.",
  "",
  "Aluno: Maria Conceição da Silva",
  "Matrícula: 2024.0012-34",
  "CPF: " + CPF_VALIDO,
  "Registro do comprador: 11144477735",
  "Exemplo de exercicio: 123.456.789-00",
  "Inscrição: o candidato deverá comparecer ao local.",
  "",
  "Questão 1 - About: assinale a alternativa correta.",
  "Gabarito comentado: alternativa B, por conta do inciso 77.",
  "Questão 2 - About: julgue os itens.",
  "Gabarito comentado: item C errado por exceção.",
].join("\n");

function fakeClient(response: string | ((prompt: string) => string), model = "fake-model"): ApostilaStructuringClient {
  return {
    available: true,
    label: model,
    async structure({ prompt }) {
      return { text: typeof response === "function" ? response(prompt) : response, model };
    },
  };
}

const unavailableClient: ApostilaStructuringClient = {
  available: false,
  label: "nenhum",
  async structure() {
    throw new Error("nao deveria ser chamado");
  },
};

describe("checksum de CPF", () => {
  it("aceita digitos validos e rejeita exemplo de aula", () => {
    expect(isCpfValid(CPF_VALIDO)).toBe(true);
    expect(isCpfValid("11144477735")).toBe(true);
    expect(isCpfValid("123.456.789-09")).toBe(true);
    expect(isCpfValid(CPF_EXEMPLO_DE_AULA)).toBe(false);
    expect(isCpfValid("111.111.111-11")).toBe(false);
    expect(isCpfValid("1234567890")).toBe(false);
  });
});

describe("sanitizacao de PII sem IA", () => {
  it("redige CPF rotulado, matricula, nome e CPF solto", () => {
    const out = ApostilaSanitizerService.redactPii({ text: APOSTILA, rules: compiledApostilaRules() });
    expect(out.text).not.toContain(CPF_VALIDO);
    expect(out.text).not.toContain("11144477735");
    expect(out.text).not.toContain("2024.0012-34");
    expect(out.text).not.toContain("Maria Conceição da Silva");
    expect(out.text).toContain("CPF: [REDACTADO]");
    expect(out.text).toContain("Aluno: [REDACTADO]");
    expect(out.counts.cpf).toBeGreaterThanOrEqual(1);
    expect(out.total).toBeGreaterThanOrEqual(4);
  });

  it("preserva o CPF de exemplo que nao e valido", () => {
    const out = ApostilaSanitizerService.redactPii({ text: APOSTILA, rules: compiledApostilaRules() });
    expect(out.text).toContain(CPF_EXEMPLO_DE_AULA);
  });

  it("preserva autoria: plataforma, assinatura, URL e dominio continuam", () => {
    const out = ApostilaSanitizerService.redactPii({ text: APOSTILA, rules: compiledApostilaRules() });
    expect(out.text).toContain("Estratégia Concursos");
    expect(out.text).toContain("Professor João Auditor");
    expect(out.text).toContain("www.estrategia.com.br/materiais");
  });

  it("nao trata prosa com dois-pontos como valor de matricula", () => {
    const out = ApostilaSanitizerService.redactPii({ text: APOSTILA, rules: compiledApostilaRules() });
    expect(out.text).toContain("Inscrição: o candidato deverá comparecer ao local.");
  });

  it("nao toca em bloco de codigo", () => {
    const text = ["```", "CPF: " + CPF_VALIDO, "```"].join("\n");
    const out = ApostilaSanitizerService.redactPii({ text, rules: compiledApostilaRules() });
    expect(out.text).toContain(CPF_VALIDO);
    expect(out.total).toBe(0);
  });

  it("e idempotente", () => {
    const rules = compiledApostilaRules();
    const once = ApostilaSanitizerService.redactPii({ text: APOSTILA, rules });
    const twice = ApostilaSanitizerService.redactPii({ text: once.text, rules });
    expect(twice.text).toBe(once.text);
    expect(twice.counts.nome).toBe(0);
  });

  it("promove fase e caixa sem apagar conteudo", () => {
    const structured = ApostilaStructurerService.normalizeOffline(APOSTILA, compiledApostilaRules());
    expect(structured.text).toContain("## Fase 01 - Teoria dos direitos fundamentais");
    expect(structured.text).toContain("> **REGRA** - os direitos fundamentais");
    expect(structured.headings).toBeGreaterThanOrEqual(1);
    expect(structured.boxes).toBeGreaterThanOrEqual(1);
    expect(structured.text).toContain("Gabarito comentado: alternativa B");
  });
});

describe("orquestrador: modos e fallback", () => {
  it("sanitize-only nao chama a IA, nem quando ela estaria disponivel", async () => {
    const spy = vi.fn(async () => {
      throw new Error("a IA nao deveria ser chamada");
    });
    const client: ApostilaStructuringClient = { available: true, label: "spy", structure: spy };
    const outcome = await ApostilaTransformerService.transformExtraction({
      text: APOSTILA,
      mode: "sanitize-only",
      client,
    });
    expect(spy).not.toHaveBeenCalled();
    expect(outcome.report.llm_usado).toBeNull();
    expect(outcome.report.modo_usado).toBe("sanitize-only");
    expect(outcome.text).not.toContain(CPF_VALIDO);
    expect(outcome.text).toContain("Estratégia Concursos");
  });

  it("structure sem provedor configurado cai no offline com aviso, sem lancar", async () => {
    const outcome = await ApostilaTransformerService.transformExtraction({
      text: APOSTILA,
      mode: "structure",
      client: unavailableClient,
    });
    expect(outcome.report.fallback_ativado).toBe(true);
    expect(outcome.report.modo_pedido).toBe("structure");
    expect(outcome.report.modo_usado).toBe("sanitize-only");
    expect(outcome.report.fallback_motivo).toContain("nao configurado");
    expect(outcome.text).not.toContain(CPF_VALIDO);
  });

  it("full com IA valida: aviso de IA no inicio e direitos no fim", async () => {
    let promptSeen = "";
    const client: ApostilaStructuringClient = {
      available: true,
      label: "fake",
      async structure({ prompt }) {
        promptSeen = prompt;
        return { text: LLM_OK, model: "fake-model" };
      },
    };
    const outcome = await ApostilaTransformerService.transformExtraction({
      text: APOSTILA,
      mode: "full",
      client,
      fileName: "aula-01.pdf",
    });
    expect(outcome.report.modo_usado).toBe("full");
    expect(outcome.report.llm_usado).toBe("fake-model");
    expect(outcome.report.aviso_ia_inserido).toBe(true);
    expect(outcome.report.fronteiras_pagina).toBe("inexistente");
    expect(outcome.text.startsWith("> **⚡ APOSTILA ADAPTADA POR INTELIGÊNCIA ARTIFICIAL**")).toBe(true);
    expect(outcome.text).toContain("adaptado por Inteligência Artificial");
    expect(outcome.text).toContain("Estratégia Concursos");
    // O PII saiu antes da chamada: o modelo nunca ve o numero de documento.
    expect(promptSeen).not.toContain(CPF_VALIDO);
    expect(promptSeen).toContain("[REDACTADO]");
  });

  it("portao de questoes: IA que condensa as questoes comentadas e rejeitada", async () => {
    const outcome = await ApostilaTransformerService.transformExtraction({
      text: APOSTILA,
      mode: "full",
      client: fakeClient(LLM_QUESTOES_PERDIDAS),
    });
    expect(outcome.report.fallback_ativado).toBe(true);
    expect(outcome.report.modo_usado).toBe("sanitize-only");
    expect(outcome.report.fallback_motivo).toContain("menos questoes");
    expect(outcome.text).toContain("Gabarito comentado: alternativa B");
  });

  it("portao de procedencia: IA que apaga a plataforma e rejeitada", async () => {
    const outcome = await ApostilaTransformerService.transformExtraction({
      text: APOSTILA,
      mode: "structure",
      client: fakeClient(LLM_SEM_PROVENIENCIA),
    });
    expect(outcome.report.fallback_ativado).toBe(true);
    expect(outcome.report.fallback_motivo).toContain("identificacao de origem");
    expect(outcome.text).toContain("Estratégia Concursos");
  });

  it("IA que falha na rede nao derruba o documento", async () => {
    const client: ApostilaStructuringClient = {
      available: true,
      label: "fake",
      async structure() {
        throw new TypeError("fetch failed");
      },
    };
    const outcome = await ApostilaTransformerService.transformExtraction({
      text: APOSTILA,
      mode: "full",
      client,
    });
    expect(outcome.report.fallback_ativado).toBe(true);
    expect(outcome.report.fallback_motivo).toContain("fetch failed");
    expect(outcome.text.length).toBeGreaterThan(100);
  });

  it("resposta curta demais e tratada como resposta invalida", async () => {
    const outcome = await ApostilaTransformerService.transformExtraction({
      text: APOSTILA,
      mode: "full",
      client: fakeClient("Resposta curta."),
    });
    expect(outcome.report.fallback_ativado).toBe(true);
    expect(outcome.report.modo_usado).toBe("sanitize-only");
  });

  it("o relatorio e um DTO valido, com os dois hashes e as contagens", async () => {
    const outcome = await ApostilaTransformerService.transformExtraction({
      text: APOSTILA,
      mode: "sanitize-only",
      sha256Original: "a".repeat(64),
      documentId: "doc-1",
    });
    expect(() => ApostilaTransformReportSchema.parse(outcome.report)).not.toThrow();
    expect(outcome.report.sha256_original).toBe("a".repeat(64));
    expect(outcome.report.sha256_transformado).toBe(sha(outcome.text));
    expect(outcome.report.regras_fonte).toBe("arquivo");
    expect(outcome.report.documentId).toBe("doc-1");
    expect(outcome.report.questoes_entrada).toBe(2);
    expect(outcome.report.questoes_saida).toBe(2);
    expect(outcome.report.questoes_preservadas).toBe(true);
    expect(outcome.report.pii_removidos).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(outcome.report)).not.toContain(CPF_VALIDO);
    expect(JSON.stringify(outcome.report)).not.toContain("Maria Conceição");
  });

  it("kill-switch devolve o texto extraido cru", async () => {
    expect(isTransformDisabled({ APOSTILA_TRANSFORM_DISABLED: "1" })).toBe(true);
    expect(isTransformDisabled({})).toBe(false);
    const outcome = await ApostilaTransformerService.transformExtraction({
      text: APOSTILA,
      env: { APOSTILA_TRANSFORM_DISABLED: "true" },
    });
    expect(outcome.text).toBe(APOSTILA);
    expect(outcome.report.pii_removidos).toBe(0);
    expect(outcome.report.avisos.join(" ")).toContain("APOSTILA_TRANSFORM_DISABLED");
  });

  it("por pagina: preserva as fronteiras e redige so onde ha PII", async () => {
    const pages = [
      "Fase 01 - Direitos fundamentais\n\nTexto de abertura.",
      "Aluno: Maria Conceição da Silva\nCPF: " + CPF_VALIDO,
      "Questão 1 - assinale.\nGabarito comentado: alternativa B, item 77.",
    ];
    const outcome = await ApostilaTransformerService.transformPages({
      pages,
      documentId: "doc-2",
    });
    expect(outcome.pages).toHaveLength(3);
    expect(outcome.pages[1]).not.toContain(CPF_VALIDO);
    expect(outcome.pages[0]).toContain("## Fase 01 - Direitos fundamentais");
    expect(outcome.pages[2]).toContain("Gabarito comentado: alternativa B, item 77.");
    expect(outcome.report.fronteiras_pagina).toBe("preservadas");
    expect(outcome.pages).toEqual([
      "## Fase 01 - Direitos fundamentais\n\nTexto de abertura.",
      "Aluno: [REDACTADO]\nCPF: [REDACTADO]",
      "Questão 1 - assinale.\nGabarito comentado: alternativa B, item 77.",
    ]);
    expect(outcome.report.sha256_transformado).toBe(sha(outcome.pages.join("\n\n")));
    expect(countQuestions(outcome.pages.join("\n\n"), compiledApostilaRules())).toBe(1);
  });

  it("regras vindas do arquivo mudam o resultado, sem redeploy", async () => {
    const dir = await mkdtemp(join(tmpdir(), "transform-"));
    const file = join(dir, "regras.md");
    await writeFile(
      file,
      rulesMarkdown({ pii: "desativado", mark: "[OPTIONAL]" }),
      "utf8",
    );
    const outcome = await ApostilaTransformerService.transformExtraction({
      text: APOSTILA,
      mode: "sanitize-only",
      env: { APOSTILA_RULES_PATH: file },
    });
    // PII desligado no arquivo: nada e redigido, e o relatorio diz a versao lida.
    expect(outcome.text).toContain(CPF_VALIDO);
    expect(outcome.report.pii_removidos).toBe(0);
    expect(outcome.report.regras_fonte).toBe("arquivo");
    await rm(dir, { recursive: true, force: true });
  });
});

function sha(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function rulesMarkdown(parts: { pii: string; mark: string }): string {
  return `# Regras

\`\`\`yaml
---
versao: 2026-10-18.2
modo: sanitize-only
pii: ${parts.pii}
estrutura: ativado
aviso_ia_quando_llm: ativado
marca_redacao: ${parts.mark}
llm_max_chars: 32000
llm_temperature: 0.4
---
\`\`\`

## campos_pii

- cpf: cpf
- nome: aluno

## marcadores_questao

- questao
- gabarito comentado

## marcas_de_procedencia

- estrategia
`;
}

const LLM_OK = [
  "## Fase 01 - Direitos fundamentais",
  "Estratégia Concursos - Apostila de Direito Constitucional, material em www.estrategia.com.br/materiais.",
  "> **REGRA** - os direitos fundamentais podem ser restringidos por lei.",
  "Texto de apoio com alguma extensao para passar no minimo de duzentos caracteres exigidos pelo portao de resposta valida, porque uma frase solta nao e um documento e nao pode entrar no indice como se fosse.",
  "Questão 1 - assinale a alternativa correta sobre o inciso 77.",
  "Gabarito comentado: alternativa B.",
  "Questão 2 - julgue os itens a seguir.",
  "Gabarito comentado: item C errado por exceção.",
].join("\n");

const LLM_QUESTOES_PERDIDAS = LLM_OK.replace(
  "Questão 2 - julgue os itens a seguir.\nGabarito comentado: item C errado por exceção.",
  "As demais questoes foram condensadas em uma frase de resumo.",
);

const LLM_SEM_PROVENIENCIA = LLM_OK.replace(
  "Estratégia Concursos - Apostila de Direito Constitucional, material em www.estrategia.com.br/materiais.",
  "Apostila de Direito Constitucional reorganizada para estudo.",
);

describe("rodape de marca d'agua: CPF e nome do comprador", () => {
  const WATERMARK = "11144477735 - Comprador Da Silva Moraes";
  const pages = [1, 2, 3].map((n) =>
    [
      "Aula 0" + n,
      "Conteudo real da pagina " + n + ", com explicacao e exemplos suficientes para nao ser mobilia.",
      WATERMARK,
    ].join("\n"),
  );

  it("redige CPF e nome quando a linha se repete em todas as paginas", async () => {
    const outcome = await ApostilaTransformerService.transformPages({ pages, documentId: "doc-3" });
    const text = outcome.pages.join("\n\n");
    expect(text).not.toContain("11144477735");
    expect(text).not.toContain("Comprador Da Silva Moraes");
    expect(outcome.report.pii_por_tipo.cpf).toBe(3);
    expect(outcome.report.pii_por_tipo.nome).toBe(3);
    expect(outcome.report.rodape_repetido).toBeGreaterThanOrEqual(3);
    // "Aula 0N" sozinho e cabecalho corrido: nao pode virar fase.
    expect(outcome.report.fases_criadas).toBe(0);
  });

  it("nao redige nome de linha que aparece uma vez sola", () => {
    const out = ApostilaSanitizerService.redactPii({
      text: WATERMARK,
      rules: compiledApostilaRules(),
    });
    expect(out.text).toBe("[REDACTADO] - Comprador Da Silva Moraes");
    expect(out.counts.nome).toBe(0);
    expect(out.boilerplate).toBe(0);
  });

  it("preserva o rodape quando o que vem depois do CPF e a plataforma", () => {
    const line = "11144477735 - Estratégia Concursos";
    const out = ApostilaSanitizerService.redactPii({
      text: line,
      rules: compiledApostilaRules(),
      boilerplateKeys: new Set(["11144477735 - estratégia concursos"]),
    });
    expect(out.text).toBe("[REDACTADO] - Estratégia Concursos");
    expect(out.counts.nome).toBe(0);
  });
});



