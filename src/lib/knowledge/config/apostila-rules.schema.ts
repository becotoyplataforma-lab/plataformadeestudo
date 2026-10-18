/**
 * ConcursoAI — schema das regras editoriais de apostila
 *
 * Faz o parse e a validacao de `apostila-rules.md` (o arquivo versionado que o
 * time editorial mexe sem mexer em codigo). Zod e obrigatorio aqui porque o
 * arquivo vira comportamento de escrita em banco: regra malformada processando
 * meio lote e pior do que regra nenhuma, porque o manifesto nao distingue.
 *
 * Duas decisoes de seguranca:
 *  - Os vocabularios do arquivo sao **literais**, nunca regex. O codigo escapa
 *    e monta o padrao. Arquivo de config nao pode injetar expressao arbitraria
 *    (ReDoS) nem apagar conteudo por engano com uma classe mal escrita.
 *  - Chave desconhecida ou valor inválido é issue, nao ignorado: typo em config
 *    que e engolido vira "achei que estava ligado".
 */
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { APOSTILA_TRANSFORM_MODES, type ApostilaTransformMode } from "../dto/apostila-transform.dto";

/** Caminho default do arquivo; `APOSTILA_RULES_PATH` cobre para deploy empacotado. */
export const APOSTILA_RULES_PATH_ENV = "APOSTILA_RULES_PATH";
export const APOSTILA_RULES_DEFAULT_RELATIVE = path.join(
  "src",
  "lib",
  "knowledge",
  "config",
  "apostila-rules.md",
);

const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

/** Tipos de identificador pessoal redigivel. Nao e lista de "o que incomoda". */
export const PII_FIELD_KINDS = [
  "cpf",
  "matricula",
  "identidade",
  "conselho",
  "carteira",
  "nome",
] as const;

export const PiiFieldKindSchema = z.enum(PII_FIELD_KINDS);
export type PiiFieldKind = z.infer<typeof PiiFieldKindSchema>;

const PiiFieldSchema = z.object({
  kind: PiiFieldKindSchema,
  rotulos: z.array(z.string().min(1).max(60)).min(1).max(40),
});

export const ApostilaRulesSchema = z.object({
  versao: z.string().regex(VERSION_PATTERN, "versao aceito alfanumerico com . _ - (max 40)"),
  modo: z.enum(APOSTILA_TRANSFORM_MODES),
  pii: z.boolean(),
  estrutura: z.boolean(),
  aviso_ia_quando_llm: z.boolean(),
  marca_redacao: z.string().min(2).max(40),
  llm_max_chars: z.number().int().min(2000).max(64000),
  llm_temperature: z.number().min(0).max(1),
  campos_pii: z.array(PiiFieldSchema).min(1),
  marcadores_questao: z.array(z.string().min(2).max(40)).min(1).max(40),
  marcas_procedencia: z.array(z.string().min(2).max(60)).min(1).max(60),
});

export type ApostilaRules = z.infer<typeof ApostilaRulesSchema>;

export const APOSTILA_RULES_COMPILED_VERSION = "2026-10-18.1";

/**
 * Regras compiladas: a mesma tabela do arquivo, embutida para o caso de o
 * caminho nao existir no bundle. Quando isto divergir do .md, o relatorio mostra
 * `fonte: "compilado"` e a divergencia fica visivel no log.
 */
export function compiledApostilaRules(): ApostilaRules {
  return {
    versao: APOSTILA_RULES_COMPILED_VERSION,
    modo: "sanitize-only",
    pii: true,
    estrutura: true,
    aviso_ia_quando_llm: true,
    marca_redacao: "[REDACTADO]",
    llm_max_chars: 32000,
    llm_temperature: 0.4,
    campos_pii: [
      { kind: "cpf", rotulos: ["cpf"] },
      {
        kind: "matricula",
        rotulos: [
          "matricula",
          "matricula funcional",
          "registro funcional",
          "registro",
          "inscricao",
          "insc",
          "numero de inscricao",
          "codigo de identificacao",
          "codigo de matricula",
          "id funcional",
        ],
      },
      { kind: "identidade", rotulos: ["rg", "rss", "cedula de identidade", "identidade"] },
      { kind: "conselho", rotulos: ["oab", "crp", "crc", "coren", "cra", "cref"] },
      { kind: "carteira", rotulos: ["cnh"] },
      {
        kind: "nome",
        rotulos: [
          "aluno",
          "nome do aluno",
          "nome do candidato",
          "candidato",
          "estudante",
          "participante",
          "comprador",
          "titular",
          "licenca pessoal",
        ],
      },
    ],
    marcadores_questao: [
      "questao",
      "questoes",
      "exercicio",
      "exercicios",
      "prova comentada",
      "gabarito comentado",
    ],
    marcas_procedencia: [
      "estrategia",
      "gran",
      "direcao",
      "alfacon",
      "cers",
      "qconcursos",
      "faculdade conservador",
      "admiratus",
      "transversale",
    ],
  };
}

/** Resultado do parse: nunca "meio valido". Ou as regras inteiras, ou o fallback. */
export type ApostilaRulesParseResult =
  | { ok: true; rules: ApostilaRules }
  | { ok: false; issues: string[] };

const TRUE_WORDS = new Set(["ativado", "true", "sim", "on", "1"]);
const FALSE_WORDS = new Set(["desativado", "false", "nao", "não", "off", "0"]);

function coerceScalar(raw: string): string | boolean | number {
  const value = raw.trim().replace(/^["']|["']$/g, "");
  const lower = value.toLowerCase();
  if (TRUE_WORDS.has(lower)) return true;
  if (FALSE_WORDS.has(lower)) return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

/** Bloco ```yaml do markdown: front matter de verdade nao renderiza na revisão. */
function extractRulesBlock(markdown: string): string | null {
  const match = /```ya?ml[ \t]*\r?\n([\s\S]*?)```/i.exec(markdown);
  if (!match) return null;
  return match[1].replace(/^[ \t]*---[ \t]*\r?\n/, "").replace(/\r?\n[ \t]*---[ \t]*$/, "");
}

/** Corpo da secao `## nome`, sem invadir a seguinte. Sem regex de borda: JS nao tem \Z. */
function sectionBody(markdown: string, heading: string): string {
  const wanted = heading.trim().toLowerCase();
  const collected: string[] = [];
  let inside = false;
  for (const line of markdown.split(/\r?\n/)) {
    const title = /^##\s+(.+?)\s*$/.exec(line);
    if (title) {
      if (inside) break;
      inside = title[1].trim().toLowerCase() === wanted;
      continue;
    }
    if (inside) collected.push(line);
  }
  return collected.join("\n");
}

/**
 * Itens `- xxx` da secao, com continuation de wrap.
 *
 * A continuacao so entra quando a linha anterior terminou em virgula: sem essa
 * condição o paragrafo de explicacao acima da lista seria lido como regra, e o
 * arquivo deixaria de ser so regras para ser prose executada.
 */
function sectionItems(markdown: string, heading: string): string[] {
  const items: string[] = [];
  let buffer = "";
  for (const line of sectionBody(markdown, heading).split(/\r?\n/)) {
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item) {
      if (buffer) items.push(buffer);
      buffer = item[1].trim();
      continue;
    }
    if (!buffer) continue;
    const next = line.trim();
    if (next.length > 0 && /[,;]$/.test(buffer)) {
      buffer += " " + next;
    } else {
      items.push(buffer);
      buffer = "";
    }
  }
  if (buffer) items.push(buffer);
  return items
    .map((item) => item.replace(/[,;]\s*$/, "").trim())
    .filter((item) => item.length > 0 && !item.startsWith("`"));
}

/** `matricula: a, b, c` -> { kind, rotulos }. Sem dois pontos, o rotulo e o proprio tipo. */
function parsePiiFields(items: string[]): Array<{ kind: string; rotulos: string[] }> {
  const fields: Array<{ kind: string; rotulos: string[] }> = [];
  for (const item of items) {
    const sep = item.indexOf(":");
    if (sep === -1) {
      const kind = item.trim().toLowerCase();
      fields.push({ kind, rotulos: [kind] });
      continue;
    }
    const kind = item.slice(0, sep).trim().toLowerCase();
    const rotulos = item
      .slice(sep + 1)
      .split(",")
      .map((label) => label.trim().toLowerCase())
      .filter((label) => label.length > 0);
    fields.push({ kind, rotulos: rotulos.length > 0 ? rotulos : [kind] });
  }
  return fields;
}

export function parseApostilaRules(markdown: string): ApostilaRulesParseResult {
  const block = extractRulesBlock(markdown);
  if (block === null) {
    return { ok: false, issues: ["bloco yaml das regras nao encontrado"] };
  }

  const known = new Set<string>(ApostilaRulesSchema.keyof().options as readonly string[]);
  const issues: string[] = [];
  const scalars: Record<string, string | boolean | number> = {};

  for (const line of block.split(/\r?\n/)) {
    const raw = line.trim();
    if (raw.length === 0 || raw.startsWith("#")) continue;
    const sep = raw.indexOf(":");
    if (sep === -1) {
      issues.push("linha sem `chave: valor` no bloco de regras: " + raw.slice(0, 40));
      continue;
    }
    const key = raw.slice(0, sep).trim();
    if (!known.has(key)) {
      issues.push("chave desconhecida em apostila-rules.md: " + key);
      continue;
    }
    scalars[key] = coerceScalar(raw.slice(sep + 1));
  }

  const parsed = ApostilaRulesSchema.safeParse({
    ...scalars,
    campos_pii: parsePiiFields(sectionItems(markdown, "campos_pii")),
    marcadores_questao: sectionItems(markdown, "marcadores_questao").map((m) => m.toLowerCase()),
    marcas_procedencia: sectionItems(markdown, "marcas_de_procedencia").map((m) => m.toLowerCase()),
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) issues.push(issue.path.join(".") + ": " + issue.message);
    return { ok: false, issues };
  }
  return { ok: true, rules: parsed.data };
}

/** Bundle entregue ao pipeline: regras + a versao que vai no relatorio de auditoria. */
export type ApostilaRulesBundle = {
  rules: ApostilaRules;
  /** `2026-10-18.1+1a2b3c4d` quando vem do arquivo, `+compilado` quando nao. */
  versao: string;
  fonte: "arquivo" | "compilado";
  avisos: string[];
};

let cache: { signature: string; bundle: ApostilaRulesBundle } | null = null;

function compiledBundle(aviso: string): ApostilaRulesBundle {
  const rules = compiledApostilaRules();
  return {
    rules,
    versao: rules.versao + "+compilado",
    fonte: "compilado",
    avisos: [aviso],
  };
}

/** Caminho efetivo do arquivo; `APOSTILA_RULES_PATH` existe para deploy empacotado. */
export function resolveApostilaRulesPath(env: Record<string, string | undefined> = process.env): string {
  const override = (env[APOSTILA_RULES_PATH_ENV] ?? "").trim();
  if (override) return path.resolve(override);
  return path.join(process.cwd(), APOSTILA_RULES_DEFAULT_RELATIVE);
}

/**
 * Le as regras com cache por `mtime` + tamanho.
 *
 * O mtime e o que torna "editar sem redeploy" verdade: sem ele o processo longo
 * conserva a primeira versiao lida e a edicao so valeria depois de um restart,
 * que e exatamente o redeploy que a regra prometia evitar. Arquivo ausente ou
 * invalido devolve as regras compiladas com aviso: upload nunca falha por config,
 * mas a auditoria enxerga que nao foram as regras do arquivo que rodaram.
 */
export async function loadApostilaRules(
  env: Record<string, string | undefined> = process.env,
): Promise<ApostilaRulesBundle> {
  const filePath = resolveApostilaRulesPath(env);
  try {
    const stat = await fs.stat(filePath);
    const signature = stat.mtimeMs + ":" + stat.size;
    if (cache && cache.signature === signature) return cache.bundle;

    const content = await fs.readFile(filePath, "utf8");
    const parsed = parseApostilaRules(content);
    if (!parsed.ok) {
      return compiledBundle(
        "apostila-rules.md invalido (" +
          parsed.issues.slice(0, 3).join("; ") +
          "): regras compiladas aplicadas",
      );
    }
    const digest = createHash("sha256").update(content, "utf8").digest("hex").slice(0, 8);
    const bundle: ApostilaRulesBundle = {
      rules: parsed.rules,
      versao: parsed.rules.versao + "+" + digest,
      fonte: "arquivo",
      avisos: [],
    };
    cache = { signature, bundle };
    return bundle;
  } catch {
    cache = null;
    return compiledBundle(
      "arquivo de regras nao lido em " +
        APOSTILA_RULES_DEFAULT_RELATIVE +
        ": regras compiladas aplicadas",
    );
  }
}

/** Descarta a cache de mtime. Só para testes: o processo compartilha o modulo. */
export function resetApostilaRulesCache(): void {
  cache = null;
}



/** O modo pedido existe na lista de modos? `APOSTILA_TRANSFORM_MODE` vem de fora. */
export function isApostilaTransformMode(value: unknown): value is ApostilaTransformMode {
  return typeof value === "string" && (APOSTILA_TRANSFORM_MODES as readonly string[]).includes(value);
}
