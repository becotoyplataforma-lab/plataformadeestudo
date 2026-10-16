/**
 * O servidor MCP do editor e a mesma porta de entrada do upload: precisa expor o
 * catalogo, o contrato de formatos e recusar o que nao tem extrator.
 *
 * Tudo aqui e somente leitura por natureza: nenhuma chamada toca banco, storage
 * ou rede. E isso que permite deixar o MCP aberto no VS Code sem risco.
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_MCP_PROVIDER_ID } from "../contracts";
import {
  KNOWLEDGE_MCP_PROTOCOL_VERSION,
  KNOWLEDGE_MCP_SERVER_NAME,
  KNOWLEDGE_MCP_TOOLS,
  callKnowledgeMcpTool,
  handleKnowledgeMcpRequest,
  knowledgeMcpInitializeResult,
  type McpToolResult,
} from "../server";

const parse = (result: McpToolResult): Record<string, unknown> =>
  JSON.parse(result.content[0].text) as Record<string, unknown>;

describe("servidor MCP de conhecimento", () => {
  it("responde o handshake com nome, versao e protocolo", async () => {
    const res = await handleKnowledgeMcpRequest({ id: 1, method: "initialize" });
    expect(res).not.toBeNull();
    expect(res?.error).toBeUndefined();
    expect(res?.result).toEqual(knowledgeMcpInitializeResult());
    expect(knowledgeMcpInitializeResult().serverInfo).toEqual({
      name: KNOWLEDGE_MCP_SERVER_NAME,
      version: expect.any(String),
    });
  });

  it("faz o ping e ignora notificacao sem id", async () => {
    const ping = await handleKnowledgeMcpRequest({ id: 2, method: "ping" });
    expect(ping?.result).toEqual({});
    const note = await handleKnowledgeMcpRequest({
      method: "notifications/initialized",
    });
    expect(note).toBeNull();
  });

  it("expoe as quatro ferramentas com schema", async () => {
    const res = await handleKnowledgeMcpRequest({ id: 3, method: "tools/list" });
    const result = res?.result as { tools: { name: string }[] };
    expect(result.tools.map((tool) => tool.name)).toEqual([
      "knowledge_mcp_catalog",
      "knowledge_format_contract",
      "knowledge_plan_file",
      "knowledge_transform_text",
    ]);
    expect(result.tools.length).toBe(KNOWLEDGE_MCP_TOOLS.length);
    expect(KNOWLEDGE_MCP_PROTOCOL_VERSION).toBe("2025-06-18");
  });

  it("metodo desconhecido devolve -32601", async () => {
    const res = await handleKnowledgeMcpRequest({ id: 4, method: "resources/list" });
    expect(res?.error?.code).toBe(-32601);
    expect(res?.error?.message).toContain("resources/list");
  });

  it("catalogo marca o apostila-mcp como provedor padrao", async () => {
    const payload = parse(await callKnowledgeMcpTool("knowledge_mcp_catalog"));
    const providers = payload.providers as { id: string; isDefault: boolean; capabilities: string[] }[];
    const standard = providers.find((item) => item.id === DEFAULT_MCP_PROVIDER_ID);
    expect(standard?.isDefault).toBe(true);
    expect(standard?.capabilities).toContain("reprocess");
  });

  it("contrato de formatos confirma aceite e recusa", async () => {
    const payload = parse(await callKnowledgeMcpTool("knowledge_format_contract"));
    expect(payload.acceptedExtensions).toContain("docx");
    expect(payload.acceptedExtensions).toContain("html");
    expect(payload.rejectedBinaryExtensions).toContain("epub");
    expect(payload.imageExtensions).toContain("jpg");
  });

  it("planeja arquivo pelo MCP sem escrever nada", async () => {
    const supported = await callKnowledgeMcpTool("knowledge_plan_file", {
      fileName: "aula-07.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 4096,
    });
    const plan = parse(supported).plan as Record<string, unknown>;
    expect(plan.classification).toBe("supported");
    expect(plan.processingVersion).not.toBe(plan.providerVersion);

    const rejected = await callKnowledgeMcpTool("knowledge_plan_file", {
      fileName: "apostila.epub",
      mimeType: "application/epub+zip",
      sizeBytes: 4096,
    });
    const recusa = parse(rejected).plan as Record<string, unknown>;
    expect(recusa.classification).toBe("unsupported");
    expect(String(recusa.reason)).toContain("extrator");
  });

  it("transform normaliza estrutura e preserva a procedencia", async () => {
    const result = await callKnowledgeMcpTool("knowledge_transform_text", {
      fileName: "aula-08.pdf",
      text: "Fase 01 - Concordancia" + String.fromCharCode(10) + "REGRA: verbo concorda",
    });
    const payload = parse(result) as { text: string; notes: string[] };
    expect(payload.text).toContain("## Fase 01 - Concordancia");
    expect(payload.text).toContain("> **REGRA** - verbo concorda");
    expect(payload.notes.join(" ")).toContain("procedencia");
  });

  it("provedor inexistente vira erro de dominio, nao excecao", async () => {
    const result = await callKnowledgeMcpTool("knowledge_plan_file", {
      fileName: "aula-09.pdf",
      providerId: "mcp-que-nao-existe",
    });
    expect(result.isError).toBe(true);
    expect(parse(result).error).toBe("MCP_PROVIDER_NOT_FOUND");
  });

  it("ferramenta desconhecida responde com isError", async () => {
    const result = await callKnowledgeMcpTool("inventar_ferramenta", {});
    expect(result.isError).toBe(true);
    expect(String(parse(result).error)).toContain("desconhecida");
  });

  it("tools/call pelo dispatcher devolve o mesmo resultado", async () => {
    const res = await handleKnowledgeMcpRequest({
      id: 9,
      method: "tools/call",
      params: { name: "knowledge_plan_file", arguments: { fileName: "capa.png" } },
    });
    const payload = (res?.result as { content: { text: string }[] }).content[0];
    const plan = JSON.parse(payload.text).plan as Record<string, unknown>;
    expect(plan.classification).toBe("unsupported");
  });
});
