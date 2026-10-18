/**
 * Regras editoriais de apostila: parse, validacao e cache por mtime.
 *
 * O arquivo de regras vira comportamento de escrita em banco, entao o teste que
 * importa aqui nao e "o zod passou": e "o arquivo versionado no repositorio e o
 * que o pipeline aplica". Parser que nao casa com o proprio .md cai no fallback
 * compilado em silencio, e o relatorio diria `compilado` sem ninguem olhar.
 */
import { mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  APOSTILA_RULES_DEFAULT_RELATIVE,
  compiledApostilaRules,
  loadApostilaRules,
  parseApostilaRules,
  resetApostilaRulesCache,
  resolveApostilaRulesPath,
} from "../apostila-rules.schema";

const REGEX_METACHARS = /[$.*+?|\\]|\[|\]|\{|\}|\\/;

afterEach(() => {
  resetApostilaRulesCache();
});

describe("apostila-rules.md do repositorio", () => {
  it("e lido do disco, nao do fallback compilado", async () => {
    const bundle = await loadApostilaRules({});
    expect(bundle.fonte).toBe("arquivo");
    expect(bundle.avisos).toEqual([]);
    expect(bundle.versao).toMatch(/^2026-10-18\.1\+[0-9a-f]{8}$/);
    expect(APOSTILA_RULES_DEFAULT_RELATIVE.split(/[\\/]/).join("/")).toBe(
      "src/lib/knowledge/config/apostila-rules.md",
    );
  });

  it("traz o vocabulario de PII como literais, nao como regex", async () => {
    const bundle = await loadApostilaRules({});
    const kinds = bundle.rules.campos_pii.map((field) => field.kind);
    expect(kinds).toEqual(expect.arrayContaining(["cpf", "matricula", "nome"]));
    const labels = bundle.rules.campos_pii.flatMap((field) => field.rotulos);
    expect(labels).toContain("aluno");
    expect(labels.some((label) => REGEX_METACHARS.test(label))).toBe(false);
  });

  it("declara default sem IA e as marcas que precisam sobreviver", async () => {
    const bundle = await loadApostilaRules({});
    expect(bundle.rules.modo).toBe("sanitize-only");
    expect(bundle.rules.marcas_procedencia).toEqual(
      expect.arrayContaining(["estrategia", "gran", "direcao", "alfacon"]),
    );
  });

  it("nao contem nenhuma regra de remocao de autoria", async () => {
    const content = (await readFile(resolveApostilaRulesPath({}), "utf8")).toLowerCase();
    for (const banned of ["remover estrategia", "remover marca", "remover url", "remover dom"]) {
      expect(content).not.toContain(banned);
    }
  });
});

describe("parseApostilaRules", () => {
  it("recusa chave desconhecida em vez de engolir o typo", () => {
    const result = parseApostilaRules(validMarkdown().replace("pii: ativado", "pi: ativado"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join(" ")).toContain("chave desconhecida");
  });

  it("recusa modo fora da lista e limite absurdo", () => {
    expect(parseApostilaRules(validMarkdown().replace("modo: sanitize-only", "modo: completa")).ok).toBe(false);
    expect(parseApostilaRules(validMarkdown().replace("llm_max_chars: 32000", "llm_max_chars: 999999")).ok).toBe(false);
  });

  it("monta o campo com quebra de linha por wrap", () => {
    const result = parseApostilaRules(validMarkdown());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const matricula = result.rules.campos_pii.find((field) => field.kind === "matricula");
    expect(matricula?.rotulos).toContain("codigo de matricula");
    expect(matricula?.rotulos.every((label) => !label.includes(","))).toBe(true);
  });

  it("nao confunde prosa de explicacao com item de regra", () => {
    const result = parseApostilaRules(validMarkdown());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rules.marcadores_questao).toContain("questao");
    expect(result.rules.marcadores_questao.join(" ")).not.toContain("gate de qualidade");
  });
});

describe("loadApostilaRules", () => {
  it("cai no compilado com aviso quando o arquivo e invalido", async () => {
    const dir = await mkdtemp(join(tmpdir(), "regras-"));
    const bad = join(dir, "ruim.md");
    await writeFile(bad, "sem bloco yaml aqui\n", "utf8");
    const bundle = await loadApostilaRules({ APOSTILA_RULES_PATH: bad });
    expect(bundle.fonte).toBe("compilado");
    expect(bundle.avisos[0]).toContain("invalido");
    expect(bundle.rules.marca_redacao).toBe(compiledApostilaRules().marca_redacao);
    await rm(dir, { recursive: true, force: true });
  });

  it("cai no compilado com aviso quando o arquivo nao existe", async () => {
    const bundle = await loadApostilaRules({ APOSTILA_RULES_PATH: join(tmpdir(), "nao-existe.md") });
    expect(bundle.fonte).toBe("compilado");
    expect(bundle.avisos[0]).toContain("nao lido");
  });

  it("rele sem restart quando o mtime muda", async () => {
    const dir = await mkdtemp(join(tmpdir(), "regras-"));
    const file = join(dir, "regras.md");
    await writeFile(file, markdownWithMark("[PII]"), "utf8");
    await utimes(file, new Date(1_700_000_000_000), new Date(1_700_000_000_000));
    const a = await loadApostilaRules({ APOSTILA_RULES_PATH: file });
    expect(a.fonte).toBe("arquivo");
    expect(a.rules.marca_redacao).toBe("[PII]");

    await writeFile(file, markdownWithMark("[SUPRIMIDO]"), "utf8");
    await utimes(file, new Date(1_700_000_000_000), new Date(1_800_000_000_000));
    const b = await loadApostilaRules({ APOSTILA_RULES_PATH: file });
    expect(b.rules.marca_redacao).toBe("[SUPRIMIDO]");
    expect(b.versao).not.toBe(a.versao);
    await rm(dir, { recursive: true, force: true });
  });

  it("mantem a mesma versao enquanto o arquivo nao muda", async () => {
    const first = await loadApostilaRules({});
    const second = await loadApostilaRules({});
    expect(second.versao).toBe(first.versao);
  });
});

function markdownWithMark(mark: string): string {
  return validMarkdown().replace("marca_redacao: [REDACTADO]", "marca_redacao: " + mark);
}

function validMarkdown(): string {
  return `# Regras

\`\`\`yaml
---
versao: 2026-10-18.1
modo: sanitize-only
pii: ativado
estrutura: ativado
aviso_ia_quando_llm: ativado
marca_redacao: [REDACTADO]
llm_max_chars: 32000
llm_temperature: 0.4
---
\`\`\`

## campos_pii

Prosa de explicacao que nao pode virar regra.

- cpf: cpf
- matricula: matricula funcional, registro,
  codigo de matricula
- nome: aluno, comprador

## marcadores_questao

Usados como gate de qualidade na saida da IA.

- questao
- gabarito comentado

## marcas_de_procedencia

Estas precisam continuar presentes.

- estrategia
- gran
`;
}

