/**
 * ConcursoAI — sanitizacao deterministica de PII (offline, sem IA)
 *
 * Redige dado pessoal de terceiros que aparece na apostila cedida a um aluno:
 * CPF, matricula, RG, numero de conselho, CNH e o nome do comprador em linhas
 * de rotulo. Nada aqui remove autoria: nome de plataforma, assinatura, URL,
 * dominio e copyright continuam no texto, conforme `AGENTS.md` (43-45) e
 * `docs/KNOWLEDGE_PIPELINE.md` (59). Redigir o CPF de quem comprou a licenca e
 * proteger uma pessoa; apagar a marca de quem escreveu o material e ocultar
 * titularidade. Sao regras diferentes e este modulo so conhece a primeira.
 *
 * Decisoes que importam:
 *  - CPF exige checksum valido. `123.456.789-00` (dado de exemplo em exercicio)
 *    nao passa no modulo 11 e nao e tocado; sequencias repetidas tambem nao.
 *  - Valor identificador precisa ter digitos. `Inscricao: o candidato devera
 *    comparecer` e prosa com dois-pontos, nao matricula.
 *  - Blocos de codigo sao ignorados, como em `normalizeStructure`.
 *  - O valor removido nao vai para lugar nenhum: o relatorio conta por tipo.
 *  - Idempotente: rodar duas vezes da o mesmo texto, porque o token de redacao
 *    nao e CPF nem nome.
 */
import { PII_COUNT_KINDS, type PiiCounts, type PiiKind } from "../dto/apostila-transform.dto";
import type { ApostilaRules } from "../config/apostila-rules.schema";

/** Familia de letras com e sem acento: `matricula` no arquivo casa com `matrícula`. */
const ACCENT_FAMILIES: Record<string, string> = {
  a: "aáàâãä",
  c: "cç",
  e: "eéèêë",
  i: "iíìîï",
  n: "nñ",
  o: "oóòôõö",
  u: "uúùûü",
  y: "yýÿ",
};

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Literal do arquivo -> fonte de regex tolerante a acento.
 *
 * O arquivo de regras nunca contem regex: contem palavras. Se ele pudesse
 * injetar padrao arbitrario, um `{2,}` aninhado derrubava o worker de ingestao e
 * uma classe mal escrita apagava conteudo em lote sem erro visivel.
 */
export function accentInsensitiveSource(literal: string): string {
  let source = "";
  for (const char of literal.trim().toLowerCase()) {
    if (/\s/.test(char)) {
      source += "\\s+";
      continue;
    }
    const family = ACCENT_FAMILIES[char];
    source += family ? "[" + family.split("").map(escapeRegExp).join("") + "]" : escapeRegExp(char);
  }
  return source;
}

const CPF_MASKED_SOURCE = "\\d{3}\\.\\s?\\d{3}\\.\\s?\\d{3}[\\-\\s]\\d{2}";
const CPF_BARE_SOURCE = "(?<![0-9])\\d{11}(?![0-9])";

/** Modulo 11 dos dois digitos verificadores. Sem isto, exemplo de aula e redigido. */
export function isCpfValid(digits: string): boolean {
  const clean = digits.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;
  const sum = (from: number, to: number, weightsFrom: number) => {
    let total = 0;
    for (let i = from; i < to; i += 1) {
      total += Number(clean[i]) * (weightsFrom - (i - from));
    }
    return total;
  };
  const dv1 = (base: number) => {
    const rest = base % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = dv1(sum(0, 9, 10));
  if (clean[9] !== String(first)) return false;
  // sum(0, 10, 11) ja inclui o primeiro digito verificador, que esta no proprio
  // numero: somar `first` de novo aceita CPF valido como invalido.
  const second = dv1(sum(0, 10, 11));
  return clean[10] === String(second);
}

/** Tipos que exigem digitos no valor. `nome` e o unico que nao exige. */
const IDENTIFIER_KINDS = new Set<string>(
  PII_COUNT_KINDS.filter((kind) => kind !== "nome"),
);

/**
 * Chaves de linha que se repetem de pagina em pagina: cabecalho corrido e rodape
 * de marca d'agua. A medicao e por paginas distintas porque uma frase legitima
 * pode aparecer tres vezes num livro, mas o rodape com o CPF do comprador aparece
 * em cada uma das 78 paginas. E o que separa "mobilia da pagina" de conteudo, sem
 * apagar autoria: a linha detectada como mobilia e tratada como PII, nao como texto.
 */
export function pageBoilerplateKeys(pages: string[]): Set<string> {
  if (pages.length < 3) return new Set();
  const perPage = new Map<string, Set<number>>();
  let inFence = false;
  pages.forEach((page, index) => {
    for (const line of page.split("\n")) {
      if (line.trim().startsWith("```")) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.length > 90) continue;
      if (!/[A-Za-z\u00C0-\u017F]/.test(trimmed)) continue;
      const key = trimmed.toLowerCase().replace(/\s+/g, " ");
      const seen = perPage.get(key) ?? new Set<number>();
      seen.add(index);
      perPage.set(key, seen);
    }
  });
  const threshold = Math.max(3, Math.floor(pages.length * 0.15));
  const keys = new Set<string>();
  for (const [key, pagesSeen] of perPage) {
    if (pagesSeen.size >= threshold) keys.add(key);
  }
  return keys;
}

/** O nome que vem depois do CPF redigido numa linha de rodape. */
function nameTailAfterMark(mark: string): RegExp {
  return new RegExp(
    "(" + escapeRegExp(mark) + ")\\s*[-\\u2013\\u2014:]\\s*([\\p{L}\\p{M}][\\p{L}\\p{M} .'-]{2,79})$",
    "u",
  );
}

export interface SanitizeOutcome {
  text: string;
  counts: PiiCounts;
  total: number;
  /** Linhas reconhecidas como cabecalho/rodape repetido de pagina. */
  boilerplate: number;
}


function bump(counts: PiiCounts, kind: string): void {
  if ((PII_COUNT_KINDS as readonly string[]).includes(kind)) {
    counts[kind as PiiKind] += 1;
  }
}

/** Nome de pessoa: letras e espacos, sem digito. Evita engolir frase com dois-pontos. */
const NAME_VALUE_SOURCE = "[\\p{L}\\p{M}][\\p{L}\\p{M} .'\\-]{1,78}";

/** Identificador: comeca em alfanumerico e aceita pontuacao de numero funcional. */
const IDENTIFIER_VALUE_SOURCE = "[A-Za-z0-9][A-Za-z0-9 ./#()\\-_]{1,58}";

/**
 * Padrao por campo do arquivo de regras. Grupos: 1 = indentacao, 2 = rotulo,
 * 3 = valor. O rotulo continua na saida de proposito: quem abre a apostila ve
 * que havia um campo de licenca ali, e nao um buraco no texto.
 */
function labelPatterns(rules: ApostilaRules): Array<{ kind: string; re: RegExp }> {
  const built: Array<{ kind: string; re: RegExp }> = [];
  for (const field of rules.campos_pii) {
    const alternation = field.rotulos.map(accentInsensitiveSource).join("|");
    if (!alternation) continue;
    const value = field.kind === "nome" ? NAME_VALUE_SOURCE : IDENTIFIER_VALUE_SOURCE;
    built.push({
      kind: field.kind,
      re: new RegExp(
        "^(\\s*)(" + alternation + ")\\s*[:\\-\\u2013\\u2014]\\s*(" + value + ")\\s*$",
        "iu",
      ),
    });
  }
  return built;
}


/** Substitui o valor redigido sem quebrar a metrica do documento. */
export const ApostilaSanitizerService = {
  /**
   * Redige PII do texto. Sempre deterministica: nenhuma chamada de rede, nenhum
   * modelo, e por isso e a base obrigatoria de todos os modos.
   */
  redactPii(input: {
    text: string;
    rules: ApostilaRules;
    /** Chaves de `pageBoilerplateKeys(pages)`: linha de rodape repetida em muitas paginas. */
    boilerplateKeys?: Set<string>;
  }): SanitizeOutcome {
    const { text, rules } = input;
    const counts: PiiCounts = {
      cpf: 0,
      matricula: 0,
      identidade: 0,
      conselho: 0,
      carteira: 0,
      nome: 0,
    };
    if (!rules.pii || text.length === 0) {
      return { text, counts, total: 0, boilerplate: 0 };
    }

    const mark = rules.marca_redacao;
    const labels = labelPatterns(rules);
    const cpfMasked = new RegExp("(?<![0-9])(" + CPF_MASKED_SOURCE + ")(?![0-9])", "g");
    const cpfBare = new RegExp(CPF_BARE_SOURCE, "g");
    const nameTail = nameTailAfterMark(mark);
    let boilerplate = 0;

    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    const out: string[] = [];
    let inFence = false;

    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        inFence = !inFence;
        out.push(line);
        continue;
      }
      if (inFence) {
        out.push(line);
        continue;
      }

      const labelHit = labels
        .map((candidate) => ({ candidate, match: candidate.re.exec(line) }))
        .find((entry) => entry.match !== null);
      if (labelHit?.match) {
        const indent = labelHit.match[1] ?? "";
        const label = labelHit.match[2] ?? "";
        const value = labelHit.match[3] ?? "";
        const needsDigits = IDENTIFIER_KINDS.has(labelHit.candidate.kind);
        const hasDigits = (value.match(/\d/g) ?? []).length >= 3;
        if (!needsDigits || hasDigits) {
          bump(counts, labelHit.candidate.kind);
          out.push(indent + label + ": " + mark);
          continue;
        }
        out.push(line);
        continue;
      }

      let redacted = line.replace(cpfMasked, (found) => {
        if (!isCpfValid(found)) return found;
        counts.cpf += 1;
        return mark;
      });
      redacted = redacted.replace(cpfBare, (found) => {
        if (!isCpfValid(found)) return found;
        counts.cpf += 1;
        return mark;
      });

      // Rodape de marca d'agua: `11144477735 - Nome do comprador` em toda pagina.
      // O CPF ja saiu acima; o nome so sai quando a linha e mobilia repetida da
      // pagina, porque e isso que distingue o dono da licenca de um credito de
      // autoria escrito uma vez sola no inicio do material.
      const key = line.trim().toLowerCase().replace(/\s+/g, " ");
      if (input.boilerplateKeys?.has(key)) {
        boilerplate += 1;
        redacted = redacted.replace(nameTail, (whole, before: string, tail: string) => {
          const folded = foldForMatching(tail.toLowerCase());
          const carriesProvenance = rules.marcas_procedencia.some((token) =>
            folded.includes(foldForMatching(token.toLowerCase())),
          );
          if (carriesProvenance) return whole;
          bump(counts, "nome");
          return before + " - " + mark;
        });
      }

      out.push(redacted);
    }

    const total = Object.values(counts).reduce((acc, value) => acc + value, 0);
    return { text: out.join("\n"), counts, total, boilerplate };
  },

  /** So conta, sem reescrever: usado pelo gate de reprocessamento do CLI. */
  countPii(input: { text: string; rules: ApostilaRules }): number {
    return ApostilaSanitizerService.redactPii(input).total;
  },
};

/** Comparacao sem acento entre o rodape detectado e o vocabulario do arquivo. */
function foldForMatching(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

