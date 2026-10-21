/**
 * Guarda de arquitetura da autorizacao de leitura de conhecimento.
 *
 * O bloqueio do piloto (Frente B) foi causado por decisao de posse espalhada em
 * varios pontos: busca, listagens e paginas comparavam `documents.user_id` com o
 * usuario que lia. Esse teste impede a regressao: a regra de posse mora no modulo
 * central e no repositorio, e nenhum caminho de leitura reimplementa isso por conta.
 *
 * Varredura estatica de arquivo-fonte: nao toca banco, storage ou rede.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(process.cwd(), "src");
const SKIP = new Set(["node_modules", ".next", "coverage"]);

function sources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) sources(p, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

const files = sources(ROOT);
const rel = (p: string) => relative(ROOT, p).split(sep).join("/");
const cache = new Map<string, string>();
const read = (p: string) => {
  const hit = cache.get(p);
  if (hit !== undefined) return hit;
  const text = readFileSync(p, "utf8");
  cache.set(p, text);
  return text;
};

/** Arquivos autorizados a escrever a condicao de posse em SQL. */
const OWNER_SQL_ALLOWLIST = new Set([
  "lib/knowledge/security/document-access.ts",
  "lib/knowledge/repositories/document.repository.ts",
  "lib/knowledge/repositories/apostilas.repository.ts",
]);

/** Unica tela que ainda lista por posse: gestao do professor sobre o proprio material. */
const LIST_BY_USER_ALLOWLIST = new Set([
  "app/(dashboard)/professor-apostilas/page.tsx",
]);

/** Caminhos de leitura que precisam usar o modulo central. */
const READ_PATHS = [
  "lib/knowledge/services/hybrid-search.service.ts",
  "app/api/knowledge/documents/route.ts",
  "app/api/knowledge/documents/[id]/route.ts",
  "app/api/knowledge/documents/[id]/download/route.ts",
  "app/api/knowledge/documents/[id]/transformado/route.ts",
  "app/(dashboard)/apostilas/page.tsx",
  "app/(dashboard)/apostilas/[id]/page.tsx",
  "app/(dashboard)/apostilas/[id]/visualizar/page.tsx",
  "app/(dashboard)/page.tsx",
  "app/(dashboard)/professor/page.tsx",
  "app/api/chat/route.ts",
];

describe("guarda de autorizacao de conhecimento", () => {
  it("varre arquivos reais de src", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(READ_PATHS.every((p) => statSync(join(ROOT, p)).isFile())).toBe(true);
  });

  it("so o modulo central e o repositorio escrevem a condicao de posse em SQL", () => {
    // O token e montado em pedaco para esta guarda nao se autodenunciar.
    const ownerSqlToken = "eq(documents." + "userId";
    const offenders = files
      .filter((f) => !rel(f).includes("__tests__"))
      .filter((f) => read(f).includes(ownerSqlToken))
      .map(rel)
      .filter((r) => !OWNER_SQL_ALLOWLIST.has(r));

    expect(offenders).toEqual([]);
  });

  it("listByUser nao volta a abastecer caminho de leitura do aluno", () => {
    const listToken = "DocumentRepository." + "listByUser";
    const callers = files
      .filter((f) => read(f).includes(listToken))
      .map(rel)
      .filter((r) => !r.includes("__tests__"));

    expect(callers.filter((r) => !LIST_BY_USER_ALLOWLIST.has(r))).toEqual([]);
  });

  it("cada caminho de leitura consome a politica central", () => {
    const missing = READ_PATHS.filter((p) => {
      const t = read(join(ROOT, p));
      return !t.includes("document-access") && !t.includes("listAccessible") && !t.includes("findByIdAccessible") && !t.includes("canAccessDocument") && !t.includes("accessScopeFromProfile");
    });

    expect(missing).toEqual([]);
  });

  it("mutacao continua sendo posse-ou-admin, nunca compartilhamento", () => {
    // Rotas que mudam estado do documento comparam posse explicitamente. Se algo
    // aqui passar a usar canAccessDocument, compartilhamento virou direito de
    // escrever no material do professor.
    const mutations = [
      "app/api/knowledge/documents/[id]/favorite/route.ts",
      "app/api/knowledge/documents/[id]/process/route.ts",
      "app/api/knowledge/documents/[id]/transformar/route.ts",
    ];
    for (const p of mutations) {
      const t = read(join(ROOT, p));
      expect(t).toContain("userId");
      expect(t).not.toContain("canAccessDocument");
    }
  });

  it("upload valida escopo antes de escrever", () => {
    expect(read(join(ROOT, "app/api/knowledge/upload/route.ts"))).toContain("validateDocumentScope");
    expect(read(join(ROOT, "app/api/admin/apostilas/batch/route.ts"))).toContain("validateDocumentScope");
  });
  it("rota RAG so abre com opt-in explicito e fecha antes de qualquer gasto", () => {
    const rag = read(join(ROOT, "app/api/ai/rag/route.ts"));
    expect(rag).toContain("RAG_API_DISABLED");
    expect(rag).toContain("RAG_ENDPOINT_DISABLED");
    // O gate vem antes de sessao, banco, quota e provedor.
    expect(rag.indexOf("readDisableFlag()")).toBeLessThan(rag.indexOf("await auth()"));
    // Opt-in estrito: truthiness de string nao pode liberar a rota.
    expect(rag.indexOf('value === "false"')).toBeGreaterThan(-1);
    expect(rag).not.toContain("Boolean(process.env.RAG_API_DISABLED)");
  });

  it("rota RAG checa quota do plano antes de gastar e registra o consumo", () => {
    const rag = read(join(ROOT, "app/api/ai/rag/route.ts"));
    expect(rag).toContain("resolveUserLimits");
    expect(rag).toContain("UsageService.checkLimit");
    expect(rag).toContain("UsageService.record");
    expect(rag.indexOf("UsageService.checkLimit")).toBeLessThan(rag.indexOf(".answer({"));
  });

  it("DTO do RAG nao aceita escopo vindo do cliente", () => {
    const dto = read(join(ROOT, "lib/dto/rag.dto.ts"));
    expect(dto).not.toContain("position_id:");
    expect(dto).not.toContain("edital_id:");
    expect(read(join(ROOT, "app/api/ai/rag/route.ts"))).toContain("resolveCourseScope");
  });
});