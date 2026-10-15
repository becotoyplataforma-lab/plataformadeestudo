import { describe, expect, it } from "vitest";

import { DEFAULT_MCP_PROVIDER_ID, McpError, MCP_PROTOCOL_VERSION } from "../contracts";
import {
  APOSTILA_MCP_ID,
  APOSTILA_MCP_VERSION,
  APOSTILA_PROCESSING_VERSION,
  APOSTILA_PROCESSING_VERSION_ENV,
  apostilaMcpProvider,
  resolveApostilaProcessingVersion,
} from "../providers/apostila-mcp";
import { createMockMcpProvider } from "../providers/mock-mcp";
import {
  assertMcpCapability,
  listMcpProviders,
  mcpProviderCatalog,
  registerMcpProvider,
  requireMcpProvider,
  resolveMcpProvider,
} from "../registry";
import { readMcpProviderId } from "@/lib/validations/knowledge";

const input = (fileName: string, extra: Record<string, unknown> = {}) => (
  {
    fileName,
    mimeType: "application/pdf",
    sizeBytes: 1024,
    sha256: "0".repeat(64),
    ...extra,
  }
);

describe("apostilaMcpProvider: plano de ingestao", () => {
  it("recupera a ordem real da aula, nao a ordem do filesystem", async () => {
    const plan = await apostilaMcpProvider.plan(input("aula-11-perifrase.pdf"));
    expect(plan.lessonOrder).toBe(11);
    expect(plan.title).toBe("Aula 11 - perifrase");
    expect(plan.classification).toBe("supported");
    expect(plan.indexedByDefault).toBe(true);
  });

  it("mantem a ordem numerica das aulas independentemente da enumeracao", async () => {
    const orders: number[] = [];
    for (const name of ["aula-09-x.pdf", "aula-12-x.pdf", "aula-11-x.pdf"]) {
      const plan = await apostilaMcpProvider.plan(input(name));
      orders.push(plan.lessonOrder ?? 0);
    }
    expect(orders).toEqual([9, 12, 11]);
    expect([...orders].sort((a, b) => a - b)).toEqual([9, 11, 12]);
  });

  it("trata a copia grifada como variante fora do indice padrao", async () => {
    const plan = await apostilaMcpProvider.plan(input("aula-13-somente-em-pdf-grifado.pdf"));
    expect(plan.variant).toBe("grifado");
    expect(plan.indexedByDefault).toBe(false);
    expect(plan.tags).toContain("variante-grifado");
    expect(plan.lessonOrder).toBe(13);
  });

  it("rejeita imagem porque OCR nao esta habilitado", async () => {
    const plan = await apostilaMcpProvider.plan(input("figura.png"));
    expect(plan.classification).toBe("unsupported");
    expect(plan.reason).toContain("imagem");
  });

  it("marca conteudo de bytes zero como invalido", async () => {
    const plan = await apostilaMcpProvider.plan(input("deepseek.jpg", { allZeroContent: true }));
    expect(plan.classification).toBe("invalid");
    expect(plan.reason).toContain("bytes zero");
  });

  it("marca arquivo vazio como invalido", async () => {
    const plan = await apostilaMcpProvider.plan(input("vazio.pdf", { sizeBytes: 0 }));
    expect(plan.classification).toBe("invalid");
  });

  it("recusa nome de arquivo vazio com erro de dominio", async () => {
    await expect(apostilaMcpProvider.plan(input("   "))).rejects.toThrow(McpError);
  });

  it("grava o provedor e o protocolo nos metadados", async () => {
    const plan = await apostilaMcpProvider.plan(input("aula-01.pdf"));
    const meta = plan.metadata.mcp as Record<string, unknown>;
    expect(meta.providerId).toBe(APOSTILA_MCP_ID);
    expect(meta.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
  });

  it("normaliza o texto sem apagar autoria ou plataforma", async () => {
    const plan = await apostilaMcpProvider.plan(input("aula-01.pdf"));
    const source = "Plataforma ConcursoAI - Prof. Ana\r\n\r\n\r\n\r\ntexto   aqui  \r\n";
    if (!apostilaMcpProvider.transform) {
      throw new Error("apostila-mcp deveria declarar capacidade transform");
    }
    const result = await apostilaMcpProvider.transform({ plan, text: source });
    expect(result.text).toContain("ConcursoAI");
    expect(result.text).toContain("Prof. Ana");
    expect(result.text).not.toContain("\n\n\n");
    expect(result.notes.join(" ")).toContain("procedencia");
  });
});

describe("registry de provedores MCP", () => {
  it("resolve o provedor padrao sem id explicito", () => {
    expect(resolveMcpProvider().id).toBe(DEFAULT_MCP_PROVIDER_ID);
    expect(resolveMcpProvider(null).id).toBe(DEFAULT_MCP_PROVIDER_ID);
    expect(resolveMcpProvider("  ").id).toBe(DEFAULT_MCP_PROVIDER_ID);
  });

  it("resolve por id explicito", () => {
    expect(resolveMcpProvider("mock-mcp").id).toBe("mock-mcp");
  });

  it("lanca McpError para id inexistente", () => {
    expect(() => requireMcpProvider("nao-existe")).toThrow(McpError);
  });

  it("recusa capacidade que o provedor nao declara", () => {
    expect(() => assertMcpCapability("mock-mcp", "reprocess")).toThrow(McpError);
    expect(assertMcpCapability(APOSTILA_MCP_ID, "transform").id).toBe(APOSTILA_MCP_ID);
  });

  it("recusa id duplicado no registro", () => {
    expect(() => registerMcpProvider(createMockMcpProvider())).toThrow(McpError);
  });

  it("catalogo expoe capacidades e marca o padrao", () => {
    const catalog = mcpProviderCatalog();
    const apostila = catalog.find((p) => p.id === APOSTILA_MCP_ID);
    expect(apostila?.isDefault).toBe(true);
    expect(apostila?.capabilities).toContain("ingest");
    expect(listMcpProviders().length).toBeGreaterThan(1);
  });
});

describe("readMcpProviderId", () => {
  it("trata campo ausente como provedor padrao", () => {
    expect(readMcpProviderId(null)).toEqual({ ok: true });
    expect(readMcpProviderId("")).toEqual({ ok: true });
  });

  it("aceita id valido", () => {
    expect(readMcpProviderId("apostila-mcp")).toEqual({ ok: true, id: "apostila-mcp" });
  });

  it("recusa id malformado sem vazar detalhe do zod", () => {
    const result = readMcpProviderId("nome com espaco!");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("invalido");
  });
});

describe("apostilaMcpProvider: formatos que o extrator realmente le", () => {
  it("aceita DOCX porque a extracao usa mammoth", async () => {
    const plan = await apostilaMcpProvider.plan(
      input("aula-02.docx", {
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
    expect(plan.classification).toBe("supported");
  });

  it("aceita HTML porque a extracao faz strip de tags", async () => {
    const plan = await apostilaMcpProvider.plan(
      input("aula-03.html", { mimeType: "text/html" }),
    );
    expect(plan.classification).toBe("supported");
  });

  it("recusa EPUB porque nao ha extrator e o binario viraria texto", async () => {
    const plan = await apostilaMcpProvider.plan(
      input("apostila.epub", { mimeType: "application/epub+zip" }),
    );
    expect(plan.classification).toBe("unsupported");
    expect(plan.reason).toContain("extrator");
    expect(plan.indexedByDefault).toBe(false);
  });

  it("recusa DOC legado indicando conversao", async () => {
    const plan = await apostilaMcpProvider.plan(input("aula-04.doc"));
    expect(plan.classification).toBe("unsupported");
    expect(plan.reason).toContain("PDF ou DOCX");
  });

  it("deduz o formato pelo MIME quando o nome nao tem extensao", async () => {
    const plan = await apostilaMcpProvider.plan(
      input("arquivo-sem-extensao", { mimeType: "application/pdf" }),
    );
    expect(plan.classification).toBe("supported");
  });

  it("registra versao de processacao distinta da versao do provedor", async () => {
    const plan = await apostilaMcpProvider.plan(input("aula-05.pdf"));
    expect(plan.processingVersion).toBe(APOSTILA_PROCESSING_VERSION);
    expect(plan.providerVersion).not.toBe(APOSTILA_PROCESSING_VERSION);
    const meta = plan.metadata.mcp as Record<string, unknown>;
    expect(meta.processingVersion).toBe(APOSTILA_PROCESSING_VERSION);
  });
});

describe("apostilaMcpProvider: transformacao editorial legitima", () => {
  const run = async (text: string) => {
    const plan = await apostilaMcpProvider.plan(input("aula-06.pdf"));
    if (!apostilaMcpProvider.transform) {
      throw new Error("apostila-mcp deveria declarar capacidade transform");
    }
    return apostilaMcpProvider.transform({ plan, text });
  };

  it("promove abertura de fase a cabecalho Markdown", async () => {
    const result = await run("Fase 01 - Concord\u00e2ncia verbal\ntexto da fase");
    expect(result.text).toContain("## Fase 01 - Concord\u00e2ncia verbal");
    expect(result.notes.join(" ")).toContain("fase");
  });

  it("normaliza caixas de destaque sem reescrever o conteudo", async () => {
    const result = await run(
      [
        "REGRA: o verbo concorda com o sujeito",
        "ATEN\u00c7\u00c3O: a banca troca o sujeito",
        "DICA - leia o enunciado duas vezes",
        "CUIDADO: n\u00e3o confunda crase com acento",
      ].join("\n"),
    );
    expect(result.text).toContain("> **REGRA** - o verbo concorda com o sujeito");
    expect(result.text).toContain("> **ATEN\u00c7\u00c3O** - a banca troca o sujeito");
    expect(result.text).toContain("> **DICA** - leia o enunciado duas vezes");
    expect(result.text).toContain("> **CUIDADO** - n\u00e3o confunda crase com acento");
    expect(result.notes.join(" ")).toContain("caixa");
  });

  it("preserva autoria, plataforma, URL e aviso de direitos", async () => {
    const origem = [
      "Estrat\u00e9gia Concursos - Prof. Felipe Santos",
      "www.exemploconcursos.com.br",
      "05201664776 - Fernando Augusto",
      "\u00a9 2026 Todos os direitos reservados",
    ].join("\n");
    const result = await run(origem);
    for (const linha of origem.split("\n")) {
      expect(result.text).toContain(linha);
    }
    expect(result.notes.join(" ")).toContain("nenhuma regra de remocao aplicada");
  });

  it("nao converte prosa comum em caixa de destaque", async () => {
    const result = await run("Regra de tr\u00eas \u00e9 assunto recorrente na prova");
    expect(result.text).not.toContain("> **REGRA**");
    expect(result.text).toContain("Regra de tr\u00eas");
  });

  it("insere aviso de adaptacao por IA e aviso de direitos do autor original", async () => {
    const result = await run("Fase 01 - Abertura\nconteudo da fase");
    expect(result.text.trimStart().startsWith("> **")).toBe(true);
    expect(result.text).toContain("INTELIG\u00caNCIA ARTIFICIAL");
    expect(result.text).toContain("s\u00e3o de seus respectivos autores");
  });

  it("nao remarca linhas dentro de bloco de codigo", async () => {
    const result = await run(
      ["```", "Fase 99 - exemplo", "REGRA: literal", "``" + "`"].join("\n"),
    );
    expect(result.text).toContain("Fase 99 - exemplo");
    expect(result.text).not.toContain("## Fase 99");
    expect(result.text).not.toContain("> **REGRA** - literal");
  });

  it("e idempotente: reprocessar nao duplica avisos nem caixas", async () => {
    const uma = await run("REGRA: verbo concorda\nFase 02 - Sintaxe\nconteudo");
    const duas = await run(uma.text);
    expect(duas.text).toBe(uma.text);
    expect((duas.text.match(/INTELIG\u00caNCIA ARTIFICIAL/g) ?? []).length).toBe(1);
    expect((duas.text.match(/> \*\*REGRA\*\*/g) ?? []).length).toBe(1);
    expect((duas.text.match(/^## /gm) ?? []).length).toBe(1);
  });
});


describe("cobertura editorial via ambiente (APOSTILA_PROCESSING_VERSION)", () => {
  const envCom = (valor: string): NodeJS.ProcessEnv => ({
    ...process.env,
    [APOSTILA_PROCESSING_VERSION_ENV]: valor,
  });
  const semCobertura = (): NodeJS.ProcessEnv => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env[APOSTILA_PROCESSING_VERSION_ENV];
    return env;
  };

  it("usa o padrao compilado quando a variavel nao esta definida", () => {
    expect(resolveApostilaProcessingVersion(semCobertura())).toBe(
      APOSTILA_PROCESSING_VERSION
    );
    expect(resolveApostilaProcessingVersion(envCom("   "))).toBe(
      APOSTILA_PROCESSING_VERSION
    );
  });

  it("aceita cobertura com formato de versao valido", () => {
    expect(resolveApostilaProcessingVersion(envCom("2026.09.13-rc1"))).toBe(
      "2026.09.13-rc1"
    );
  });

  it("descarta cobertura malformada e mantem o padrao, sem explodir o lote", () => {
    expect(resolveApostilaProcessingVersion(envCom("duas linhas; ok"))).toBe(
      APOSTILA_PROCESSING_VERSION
    );
    expect(resolveApostilaProcessingVersion(envCom("-comeca-com-hifen"))).toBe(
      APOSTILA_PROCESSING_VERSION
    );
    expect(resolveApostilaProcessingVersion(envCom("x".repeat(80)))).toBe(
      APOSTILA_PROCESSING_VERSION
    );
  });

  it("a cobertura aceita nunca coincide com a versao do provedor", () => {
    expect(resolveApostilaProcessingVersion(envCom("editorial-2"))).not.toBe(
      APOSTILA_MCP_VERSION
    );
  });
});
