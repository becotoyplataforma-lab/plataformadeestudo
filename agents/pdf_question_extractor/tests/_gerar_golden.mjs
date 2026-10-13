// Gera tests/golden_hash.json a partir de copia literal do TS.
//
// As funcoes abaixo sao copiadas de src/lib/administration/services/
// question-import.service.ts (linhas 142-203) sem mudanca de semantica.
// Rodar: node agents/pdf_question_extractor/tests/_gerar_golden.mjs
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const LETTER_COLUMNS = ["a", "b", "c", "d", "e"];

// --- TS 142-151, literal ---
function normalizeGabarito(value) {
  if (!value) return undefined;
  const letters = value.toUpperCase().match(/[A-E]/g) ?? [];
  if (letters.length === 0) return undefined;
  const distinct = [...new Set(letters)];
  if (distinct.length === 1) return distinct[0];
  return letters[letters.length - 1];
}

// --- TS 157-178 (recorte: enunciado/alternativas/gabarito) ---
function parseRow(values) {
  const enunciado = (values.enunciado ?? "").trim();
  const alternativas = LETTER_COLUMNS.map((letter) => ({
    letter: letter.toUpperCase(),
    text: (values[`alt_${letter}`] ?? "").trim(),
  })).filter((a) => a.text.length > 0);
  const gabarito = normalizeGabarito(values.gabarito);
  return { enunciado, alternativas, gabarito: gabarito ?? "" };
}

// --- TS 191-203, literal ---
function computeHash(q) {
  const body = [
    q.enunciado,
    ...q.alternativas.map((a) => `${a.letter}:${a.text}`),
    q.gabarito,
  ]
    .join("||")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  return createHash("sha256").update(body).digest("hex");
}

const RAW_VECTORS = [
  ["Questões de ortografia: crase, til e porquês.", ["A: certo", "B: errado"], "A"],
  ["  Espacos nas bordas  ", ["A: um", "B: dois"], "B"],
  ["Nova  linha\nquebra   aqui\ttab", ["A: ô", "B: ã", "C: é"], "C"],
  ["ÁÉÍÓÚ À ÃÕ Ç Ü", ["A: a", "B: b", "C: c", "D: d", "E: e"], "E"],
  ["", ["A: v"], ""],
  ["Combining dentro do bloco: a\u0327b", ["A: x"], "A"],
  ["Combining fora do bloco: a\u0483b", ["A: x"], "A"],
  ["números 12345 e símbolos /|-•§", ["A: y", "B: z"], "D"],
  ["  a  b  ", ["A: x"], "A"],
];

/** Copia da cadeia de normalizacao do TS, para comparar o intermediario. */
function normalizedBody(q) {
  return [q.enunciado, ...q.alternativas.map((a) => `${a.letter}:${a.text}`), q.gabarito]
    .join("||")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

const IMPORT_VECTORS = [
  {
    enunciado: "  Identificam-se no vocábulo “lexicais” oito letras.  ",
    alt_a: "  Certo  ", alt_b: "", alt_c: "Errado", gabarito: "C",
  },
  {
    enunciado: "O vocábulo “histórico” tem nove letras.",
    alt_a: "um", alt_b: " dois ", alt_c: "", alt_d: "", alt_e: "", gabarito: "letra B",
  },
  {
    enunciado: "Questão sem gabarito normalizável.",
    alt_a: "a", alt_b: "b", gabarito: "NULA",
  },
];

// Casos que provam por que a palavra por extenso NAO pode ser importada.
const GABARITO_DANGER = ["Correto.", "Certo.", "Errado.", "Verdadeiro.", "Incorreto.", "D"];

const out = {
  raw: RAW_VECTORS.map(([enunciado, alts, gabarito]) => {
    const alternativas = alts.map((s) => {
      const i = s.indexOf(":");
      return { letter: s.slice(0, i), text: s.slice(i + 1) };
    });
    const q = { enunciado, alternativas, gabarito };
    return {
      enunciado,
      alternativas: alts.map((s) => s.split(":")),
      gabarito,
      body: [enunciado, ...alts, gabarito].join("||"),
      normalized: normalizedBody(q),
      hash: computeHash(q),
    };
  }),
  import: IMPORT_VECTORS.map((values) => {
    const q = parseRow(values);
    return { values, parsed: q, hash: computeHash(q) };
  }),
  gabarito: Object.fromEntries(
    [...GABARITO_DANGER, "A", " c. ", "letra C", "Resposta: B", "", "E"].map((v) => [
      v,
      normalizeGabarito(v) ?? null,
    ])
  ),
};

const dest = new URL("./golden_hash.json", import.meta.url);
writeFileSync(dest, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log("golden_hash.json:", out.raw.length, "raw,", out.import.length, "import,", Object.keys(out.gabarito).length, "gabarito");
