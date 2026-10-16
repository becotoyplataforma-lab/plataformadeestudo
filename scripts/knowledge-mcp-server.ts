/**
 * Ponte stdio do MCP de conhecimento: um JSON-RPC por linha em stdin, uma
 * resposta por linha em stdout. Diagnostico sai em stderr, nunca em stdout,
 * porque stdout e o canal do protocolo.
 *
 * O servidor nao toca banco nem storage: e seguro deixa-lo aberto no editor.
 *
 * Configurado em .vscode/mcp.json (MCP local do VS Code).
 */
import { createInterface } from "node:readline";

import {
  KNOWLEDGE_MCP_SERVER_NAME,
  handleKnowledgeMcpRequest,
  type JsonRpcRequest,
} from "../src/lib/knowledge/mcp/server";

function write(message: unknown): void {
  process.stdout.write(JSON.stringify(message) + "\n");
}

const lines = createInterface({ input: process.stdin, terminal: false });

lines.on("line", (line) => {
  const raw = line.trim();
  if (!raw) return;

  let request: JsonRpcRequest;
  try {
    request = JSON.parse(raw) as JsonRpcRequest;
  } catch {
    write({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "JSON invalido recebido no stdin." },
    });
    return;
  }

  handleKnowledgeMcpRequest(request)
    .then((response) => {
      if (response) write(response);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "falha desconhecida";
      process.stderr.write("[" + KNOWLEDGE_MCP_SERVER_NAME + "] " + message + "\n");
    });
});

lines.on("close", () => {
  process.exit(0);
});
