/**
 * Revisao estatica do ensaio de catalogo (sql/rehearsal/r65-probes.sql).
 *
 * Este teste NAO abre conexao com banco. Ele trava, no texto, as propriedades
 * que a auditoria R6.5 cobrou, para que um defeito corrigido nao volte sem
 * alguem perceber. Nada aqui prova comportamento em PostgreSQL real: isso ainda
 * depende de instancia isolada e continua pendente.
 *
 * Defeitos cobertos (numeracao da revisao):
 *   R6.5-01 COALESCE qualificado como funcao
 *   R6.5-04 alias de HDL sem definicao
 *   R6.5-05 alias orfa depois de remover LATERAL
 *   R6.5-06 ascii_chr inexistente no PG17
 *   R6.5-07 db_oid dentro de saida assinada
 *   R6.5-08 funcao de sequencia inexistente
 *   R6.5-09 unnest em vetor de catalogo
 *   R6.5-10 hash dentro do SQL
 *   R6.5-11 relam/relhasindex assinados sem sentido
 *   R6.5-12 probin como bytea
 *   R6.5-13 indhasindex
 *   R6.5-14 proargdefaults como array
 *   R6.5-15 unnest em oidvector
 *   R6.5-16 coluna fisica (reltuples) dentro do token
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const LF = String.fromCharCode(10);
const SQL_PATH = join(process.cwd(), "sql", "rehearsal", "r65-probes.sql");
const sql = readFileSync(SQL_PATH, "utf-8");

/** Texto sem linhas de comentario: regra de syntaxe nao se prova contra prosa. */
const code = sql
  .split(LF)
  .filter((line) => !line.trim().startsWith("--"))
  .join(LF)
  .replace(/'[A-Za-z0-9_\.\\]*'/g, "'string'");

type Block = { label: string; title: string; body: string; index: number };

const LABEL_LINE = /^-- \[(E-diagnostico|E|P|C)\]/;

/**
 * Um bloco comeca na linha de titulo ("-- [E] ...", "-- [P] ...") e vai ate o
 * proximo titulo. O corpo guarda os proprios comentarios: "Esperado" e
 * "Aborto" sao parte do contrato do bloco, e nao de um texto solto no arquivo.
 */
function blocks(): Block[] {
  const lines = sql.split(LF);
  const out: Block[] = [];
  let current: Block | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const match = LABEL_LINE.exec(lines[i]);
    if (match) {
      if (current) out.push(current);
      current = {
        label: match[1],
        title: lines[i].replace("^-- ", "").trim(),
        body: lines[i] + LF,
        index: i,
      };
      continue;
    }
    if (current) current.body += lines[i] + LF;
  }
  if (current) out.push(current);
  return out;
}

function blockByTitle(fragment: string): Block {
  const found = BLOCKS.find((b) => b.title.includes(fragment));
  expect(found, "bloco ausente: " + fragment).toBeDefined();
  return found as Block;
}

const BLOCKS = blocks();

const RESERVED = new Set([
  "on", "where", "and", "or", "using", "inner", "left", "right", "full", "cross",
  "join", "group", "order", "limit", "offset", "as", "is", "not", "in", "select",
  "from", "having", "union", "then", "else", "end", "case", "when", "filter",
]);

describe("R6.5 - revisao estatica do SQL de ensaio", () => {
  it("o arquivo existe e nao esta vazio", () => {
    expect(sql.length).toBeGreaterThan(2000);
  });

  it("R6.5-01: COALESCE nunca e invocado como funcao qualificada", () => {
    expect(code).not.toMatch(/pg_catalog\.coalesce\s*\(/i);
    expect(code).not.toMatch(/pg_catalog\.nullif\s*\(/i);
    expect(code).not.toMatch(/pg_catalog\.greatest\s*\(/i);
    expect(code).not.toMatch(/pg_catalog\.least\s*\(/i);
  });

  it("R6.5-04: nenhuma referencia a HDL sem definicao", () => {
    expect(code).not.toMatch(/\bHDL\s*\(/);
    expect(code).toMatch(/CREATE TEMPORARY FUNCTION HXL/);
  });

  it("R6.5-06: ascii_chr nao e usado (funcao nao existe no PostgreSQL 17)", () => {
    expect(code).not.toMatch(/ascii_chr/i);
  });

  it("R6.5-08: acesso a sequencia e pela view, nao por funcao inventada", () => {
    expect(code).not.toMatch(/sequence_last_value/i);
    expect(code).not.toMatch(/sequence_concealed_value/i);
    expect(code).not.toMatch(/pg_sequence_last_value/i);
    expect(code).toMatch(/LEFT JOIN pg_sequences/);
  });

  it("R6.5-13: indhasindex (coluna que nao existe em pg_index) sumiu", () => {
    expect(code).not.toMatch(/indhasindex/i);
  });

  it("R6.5-09 e R6.5-15: vetor de catalogo nunca vai para unnest", () => {
    expect(code).not.toMatch(/unnest\s*\(\s*[a-z]+\.(indkey|indclass|indcollation|indoption)\b/i);
    expect(code).not.toMatch(/\bunnest\s*\(/i);
  });

  it("R6.5-14: proargdefaults nao e tratado como array", () => {
    expect(code).not.toMatch(/unnest\s*\([^)]*proargdefaults/i);
    expect(code).not.toMatch(/array_length\s*\([^)]*proargdefaults/i);
    expect(code).toMatch(/pg_get_function_arguments\(p\.oid\)/);
  });

  it("R6.5-12: probin e tratado como texto, nunca como bytea", () => {
    expect(code).not.toMatch(/probin[^)]*::bytea/i);
    expect(code).not.toMatch(/encode\s*\(\s*[a-z]+\.probin/i);
    expect(code).toMatch(/S0\(p\.probin\)/);
  });

  it("R6.5-10: nenhum hash roda dentro do SQL", () => {
    expect(code).not.toMatch(/\bdigest\s*\(/i);
    expect(code).not.toMatch(/\bsha256\s*\(/i);
    expect(code).not.toMatch(/\bmd5\s*\(/i);
    expect(code).not.toMatch(/\bencode\s*\(\s*decode/i);
  });

  it("R6.5-07: db_oid fora da saida, e o nome do banco entra no diagnostico", () => {
    expect(code).not.toMatch(/db_oid/i);
    expect(code).not.toMatch(/\boid\b\s*(?:\|\||AS token)/i);
    expect(code).toMatch(/current_database\(\)\s+AS database_name/);
  });
});

function declaredAliases(stmt: string): Set<string> {
  const decl = new Set<string>();
  const tableAs = /(?:FROM|JOIN)\s+([a-z_][a-z0-9_.]*)(?:\s+(?:AS\s+)?([a-z_][a-z0-9_]*))?/gi;
  let m: RegExpExecArray | null;
  while ((m = tableAs.exec(stmt)) !== null) {
    if (m[2] && !RESERVED.has(m[2].toLowerCase())) decl.add(m[2].toLowerCase());
    if (m[1]) {
      // Nome qualificado por schema (drizzle.__drizzle_migrations) nao e alias
      // orfao: o primeiro componente faz parte do nome da tabela.
      decl.add(m[1].toLowerCase().split(".")[0]);
    }
  }
  const lateral = /\)\s*(?:AS\s+)?([a-z_][a-z0-9_]*)\s+ON\b/gi;
  while ((m = lateral.exec(stmt)) !== null) decl.add(m[1].toLowerCase());
  const valuesAlias = /AS\s+([a-z_][a-z0-9_]*)\s*\(/gi;
  while ((m = valuesAlias.exec(stmt)) !== null) decl.add(m[1].toLowerCase());
  const cte = /(?:WITH|,)\s*([a-z_][a-z0-9_]*)\s+AS\s*\(/gi;
  while ((m = cte.exec(stmt)) !== null) decl.add(m[1].toLowerCase());
  return decl;
}

function statements(): string[] {
  return code
    .split(";")
    .map((s) => s.trim())
    .filter((s) => /\b(SELECT|CREATE)\b/i.test(s));
}

describe("R6.5 - contrato de rotulos, aliases e sentinelas", () => {
  it("R6.5-05: nenhum alias orfao em nenhuma instrucao", () => {
    const orphans: string[] = [];
    for (const stmt of statements()) {
      const decl = declaredAliases(stmt);
      const used = new Set<string>();
      const re = /\b([a-z_][a-z0-9_]*)\.(?=[a-z_])/gi
      let m: RegExpExecArray | null;
      while ((m = re.exec(stmt)) !== null) {
        const name = m[1].toLowerCase();
        if (RESERVED.has(name)) continue;
        if (name === "pg_catalog" || name === "pg_class") continue;
        used.add(name);
      }
      for (const alias of used) {
        if (!decl.has(alias)) {
          orphans.push(alias + " em: " + stmt.slice(0, 60).replace(/\s+/g, " "));
        }
      }
    }
    expect(orphans).toEqual([]);
  });

  it("cada instrcao declara exatamente um alias de saida assinada", () => {
    const withToken = statements().filter((s) => /AS token\b/i.test(s));
    expect(withToken.length).toBeGreaterThanOrEqual(7);
    for (const stmt of withToken) {
      const count = (stmt.match(/AS token\b/gi) ?? []).length;
      expect(count).toBe(1);
    }
  });

  it("todo bloco tem rotulo de classe conhecido", () => {
    const expected: Array<[string, string]> = [
      ["C1 - relacoes", "E"],
      ["C1A - atributos", "E"],
      ["C1S - sequencias", "E"],
      ["C2 - constraints", "E"],
      ["C4 - indices", "E"],
      ["C6 - rotinas", "E"],
      ["C7 - gatilhos", "E"],
      ["Q-SCOPE -", "E"],
      ["Q-SCOPE-ASSERT", "P"],
      ["ST-FUNC", "P"],
      ["P-CLASS-NATTS", "P"],
      ["P-SEQ-MAP", "P"],
      ["P-ATTR-PER-SEQ", "P"],
      ["P-VEC", "P"],
      ["Q-INFRA-A", "E-diagnostico"],
      ["P-LEDGER-STEP-1", "P"],
      ["P-LEDGER-STEP-2", "P"],
      ["P-LEDGER-COMPARE", "P"],
      ["FORA DO ESCOPO", "C"],
    ];
    for (const [fragment, label] of expected) {
      expect(blockByTitle(fragment).label, fragment).toBe(label);
    }
  });

  it("todo bloco [P] tem resultado esperado e condicao de aborto", () => {
    const pBlocks = BLOCKS.filter((b) => b.label === "P");
    expect(pBlocks.length).toBeGreaterThanOrEqual(8);
    for (const block of pBlocks) {
      expect(block.body, block.title).toContain("Esperado");
      expect(block.body, block.title).toContain("Aborto");
    }
  });

  it("cobertura vazia e distinguida de escopo invalido", () => {
    const natts = blockByTitle("P-CLASS-NATTS").body;
    expect(natts).toContain("COVERAGE_VOID");
    expect(natts).toContain("relations_in_scope");
    expect(natts).toContain("mismatching_relations");
  });

  it("o vocabulario de sentinela e fechado", () => {
    const allowed = new Set([
      "null",
      "none",
      "empty",
      "absent",
      "opaque",
      "ambiguous",
      "unknown",
      "r",
      "p",
      "v",
      "m",
      "f",
      "t",
      "i",
      "S",
    ]);
    const found = sql.match(/<[a-zA-Z_]+>/g) ?? [];
    const unexpected = Array.from(new Set(found.map((x) => x.replace(/[<>]/g, "")))).filter(
      (name) => !allowed.has(name)
    );
    expect(unexpected).toEqual([]);
    expect(found.join(" ")).toContain("<null>");
    expect(found.join(" ")).toContain("<none>");
  });

  it("S e S0 tem semantica de NULL distinta", () => {
    expect(sql).toMatch(/WHEN v IS NULL THEN .*<null>/);
    expect(sql).toMatch(/WHEN v IS NULL THEN .*<none>/);
    const stFunc = blockByTitle("ST-FUNC").body;
    expect(stFunc).toContain("S(NULL::int)");
    expect(stFunc).toContain("S0(NULL::int)");
  });

  it("R6.5-11 e R6.5-16: relam so onde ha access method e estatistica fora do token", () => {
    const c1 = blockByTitle("C1 - relacoes").body;
    expect(c1).toMatch(/WHEN c\.relkind IN [\s\S]*THEN am\.amname/);
    expect(c1).toContain("<absent>");
    expect(code).not.toMatch(/reltuples/);
    expect(code).not.toMatch(/relpages/);
    expect(code).not.toMatch(/relallvisible/);
  });

  it("classes fora do escopo estao nomeadas e nao contam como cobertas", () => {
    const scopeOut = blockByTitle("FORA DO ESCOPO").body;
    for (const name of [
      "C8",
      "C-ENUM",
      "C-COLL",
      "C-TS",
      "C1V",
      "pg_statistic_ext_data",
      "pg_amop",
      "pg_description",
    ]) {
      expect(scopeOut, name).toContain(name);
    }
    expect(scopeOut).toContain("PARCIAL");
  });

  it("nenhuma query de classe assinada depende do schema drizzle existir", () => {
    const c1Blocks = statements()
      .filter((s) => /AS token\b/i.test(s))
      .filter((s) => /drizzle/i.test(s));
    expect(c1Blocks).toEqual([]);
  });
});
