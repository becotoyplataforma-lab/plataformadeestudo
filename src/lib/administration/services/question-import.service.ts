/**
 * ConcursoAI — QuestionImportService (Item 7 do guia admin)
 *
 * Importa questões prontas (banco externo) a partir de CSV/XLSX/JSON, com
 * validação de formato ANTES de gravar. Questões entram como EM_REVISÃO
 * (nunca publicadas direto), origin="import", com hash de conteúdo p/ dedup.
 */
import "server-only";
import { createHash } from "crypto";
import { QuestionWriteRepository } from "@/lib/administration/repositories/question.repository";

export class QuestionImportError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "QuestionImportError";
    this.code = code;
  }
}

export interface ParsedQuestion {
  row: number;
  enunciado: string;
  alternativas: { letter: string; text: string }[];
  gabarito: string;
  explicacao?: string;
  nivel?: "facil" | "medio" | "dificil";
  ano?: number;
  banca?: string;
  cargo?: string;
  fonte?: string;
  topic?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

/**
 * Tipos que o importador sabe gravar. `certo_errado` é o item de duas
 * alternativas fixas — C = "Certo", E = "Errado" — o mesmo par sintético que o
 * extrator emite e que `verificacao.py` exige no artefato. A coluna
 * `questions.tipo` é texto com default "multipla_escolha"
 * (`src/db/schema/study.ts:170`) e a UI já distingue os dois
 * (`src/components/questoes/questao-card.tsx`, `src/lib/questoes/procedencia.ts`),
 * então quem importa lote C/E precisa dizer o tipo: sem isso, 259 questões
 * entrariam classificadas como múltipla escolha.
 */
export const TIPOS_IMPORTACAO = ["multipla_escolha", "certo_errado"] as const;

export type TipoImportacao = (typeof TIPOS_IMPORTACAO)[number];

export function isTipoImportacao(valor: unknown): valor is TipoImportacao {
  return (
    typeof valor === "string" &&
    (TIPOS_IMPORTACAO as readonly string[]).includes(valor)
  );
}

const PAR_CERTO_ERRADO = [
  { letter: "C", texto: "certo" },
  { letter: "E", texto: "errado" },
] as const;

/** "Certo." / " ERRADO " e acentos não devem confundir a checagem do par. */
function normalizarTextoAlternativa(value: string): string {
  return value
    .trim()
    .replace(/[.!?]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ============================================================
// CSV parsing (comma/semicolon, BOM, aspas)
// ============================================================

function detectDelimiter(firstLine: string): string {
  const comma = firstLine.split(",").length;
  const semicolon = firstLine.split(";").length;
  return semicolon > comma ? ";" : ",";
}

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delim = detectDelimiter(lines[0]);
  const rows: string[][] = [];
  for (const line of lines) {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delim && !inQuotes) {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    rows.push(cells.map((c) => c.trim()));
  }
  return rows;
}

// ============================================================
// Column mapping
// ============================================================

const HEADER_ALIASES: Record<string, string[]> = {
  enunciado: ["enunciado", "pergunta", "questao", "questão", "question", "statement", "texto", "text"],
  gabarito: ["gabarito", "resposta", "answer", "correct", "gabarito_correto", "resposta_correta", "alternativa_correta"],
  explicacao: ["explicacao", "explicação", "justificativa", "explanation", "comentario", "comentário"],
  nivel: ["nivel", "nível", "dificuldade", "difficulty", "level"],
  ano: ["ano", "year"],
  banca: ["banca", "organizadora"],
  cargo: ["cargo", "position", "role"],
  fonte: ["fonte", "source"],
  topic: ["tema", "topico", "tópico", "topic", "assunto"],
};

const LETTER_COLUMNS = ["a", "b", "c", "d", "e"];

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_\-\s]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function resolveColumn(header: string): string | null {
  const n = normalizeHeader(header);
  // alternativas: a/b/c/d/e, alternativa_a, opcao_a, option_a...
  for (const letter of LETTER_COLUMNS) {
    if (n === letter) return `alt_${letter}`;
    if (n === `alternativa_${letter}` || n === `opcao_${letter}` || n === `option_${letter}` || n === `alternativa${letter}`) {
      return `alt_${letter}`;
    }
  }
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((a) => normalizeHeader(a) === n)) return key;
  }
  return null;
}

function buildColumnMap(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const resolved = resolveColumn(h);
    if (resolved && map[resolved] === undefined) map[resolved] = i;
  });
  return map;
}

// ============================================================
// Parsers
// ============================================================

function parseNivel(value: string | undefined): "facil" | "medio" | "dificil" | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (v.includes("fac") || v.includes("easy")) return "facil";
  if (v.includes("dif") || v.includes("hard") || v.includes("avanc")) return "dificil";
  if (v.includes("med") || v.includes("intermedi")) return "medio";
  return undefined;
}

export function normalizeGabarito(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const letters = value.toUpperCase().match(/[A-E]/g) ?? [];
  if (letters.length === 0) return undefined;
  // Exatamente uma letra distinta (ex.: "C", "c.").
  const distinct = [...new Set(letters)];
  if (distinct.length === 1) return distinct[0];
  // Vários candidatos (ex.: "letra C", "Resposta: B") — assume a última.
  return letters[letters.length - 1];
}

export function parseQuestion(
  row: number,
  values: Record<string, string | undefined>
): ParsedQuestion {
  const enunciado = (values.enunciado ?? "").trim();
  const alternativas = LETTER_COLUMNS
    .map((letter) => ({
      letter: letter.toUpperCase(),
      text: (values[`alt_${letter}`] ?? "").trim(),
    }))
    .filter((a) => a.text.length > 0);
  const gabarito = normalizeGabarito(values.gabarito);

  return {
    row,
    enunciado,
    alternativas,
    gabarito: gabarito ?? "",
    explicacao: values.explicacao?.trim() || undefined,
    nivel: parseNivel(values.nivel),
    ano: values.ano ? Number.parseInt(values.ano, 10) || undefined : undefined,
    banca: values.banca?.trim() || undefined,
    cargo: values.cargo?.trim() || undefined,
    fonte: values.fonte?.trim() || undefined,
    topic: values.topic?.trim() || undefined,
  };
}

export function validateQuestion(
  q: ParsedQuestion,
  tipo: TipoImportacao = "multipla_escolha"
): string[] {
  const issues: string[] = [];
  if (!q.enunciado) issues.push("enunciado obrigatório");
  if (q.alternativas.length < 2) issues.push("é necessário ao menos 2 alternativas");
  if (!q.gabarito) issues.push("gabarito (A-E) obrigatório");
  else if (!q.alternativas.some((a) => a.letter === q.gabarito))
    issues.push(`gabarito ${q.gabarito} não corresponde a uma alternativa`);

  const letras = q.alternativas.map((a) => a.letter).join("");
  const ehParCertoErrado =
    letras === PAR_CERTO_ERRADO.map((p) => p.letter).join("") &&
    q.alternativas.every(
      (a, i) => normalizarTextoAlternativa(a.text) === PAR_CERTO_ERRADO[i].texto
    );

  if (tipo === "certo_errado") {
    if (letras !== "CE") {
      issues.push(`tipo certo_errado exige exatamente as alternativas C e E (linha traz: ${letras || "nenhuma"})`);
    } else if (!ehParCertoErrado) {
      issues.push('tipo certo_errado exige os textos "Certo" e "Errado"');
    }
  } else if (ehParCertoErrado) {
    issues.push("linha certo/errado (C=Certo, E=Errado) exige o tipo certo_errado");
  }

  return issues;
}

export function computeHash(q: ParsedQuestion): string {
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

// ============================================================
// File → rows
// ============================================================

async function rowsFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<Record<string, string | undefined>[]> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".csv") || mimeType.includes("csv") || mimeType.includes("text/plain")) {
    const rows = parseCsv(buffer.toString("utf8"));
    if (rows.length === 0) return [];
    const map = buildColumnMap(rows[0]);
    return rows.slice(1).map((r) => {
      const obj: Record<string, string | undefined> = {};
      for (const [key, idx] of Object.entries(map)) {
        obj[key] = r[idx];
      }
      return obj;
    });
  }

  if (lower.endsWith(".json") || mimeType.includes("json")) {
    const parsed = JSON.parse(buffer.toString("utf8"));
    if (!Array.isArray(parsed)) {
      throw new QuestionImportError("INVALID_JSON", "O JSON deve ser uma lista de questões.");
    }
    return parsed.map((item: Record<string, unknown>) => {
      const obj: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(item)) {
        const resolved = resolveColumn(key);
        if (resolved && value !== null && value !== undefined) {
          obj[resolved] = String(value);
        }
      }
      return obj;
    });
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    // SheetJS (xlsx) — import dinâmico para não quebrar quando ausente.
    type XlsxLike = {
      read: (data: Buffer, opts: { type: "buffer" }) => {
        SheetNames: string[];
        Sheets: Record<string, unknown>;
      };
      utils: {
        sheet_to_json: (
          ws: unknown,
          opts: Record<string, unknown>
        ) => Record<string, unknown>[];
      };
    };
    let XLSX: XlsxLike;
    try {
      XLSX = (await import("xlsx")) as unknown as XlsxLike;
    } catch {
      throw new QuestionImportError(
        "XLSX_UNAVAILABLE",
        "Suporte a XLSX requer a dependência 'xlsx' (npm install xlsx)."
      );
    }
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    return json.map((item: Record<string, unknown>) => {
      const obj: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(item)) {
        const resolved = resolveColumn(key);
        if (resolved && value !== "" && value !== null && value !== undefined) {
          obj[resolved] = String(value);
        }
      }
      return obj;
    });
  }

  throw new QuestionImportError(
    "UNSUPPORTED_FORMAT",
    "Formato não suportado. Use CSV, JSON ou XLSX."
  );
}

// ============================================================
// Service
// ============================================================

const LIMITE_BYTES = 10 * 1024 * 1024;
const LIMITE_LINHAS = 5000;

export interface ImportConfig {
  adminUserId: string;
  subjectId: string;
  /** Tipo de todo o lote. Default "multipla_escolha" (comportamento histórico). */
  tipo?: TipoImportacao;
  defaultBanca?: string;
  defaultCargo?: string;
  defaultAno?: number;
}

type LinhaValida = { row: number; questao: ParsedQuestion; hash: string };

/**
 * Lê e valida o lote inteiro antes de qualquer escrita, inclusive contra o
 * `tipo` declarado: lote com tipo errado nunca chega a `createQuestion`.
 */
function analisarLote(
  rows: Record<string, string | undefined>[],
  tipo: TipoImportacao
): { validas: LinhaValida[]; erros: { row: number; message: string }[]; duplicadas: number } {
  const validas: LinhaValida[] = [];
  const erros: { row: number; message: string }[] = [];
  const vistos = new Set<string>();
  let duplicadas = 0;

  for (let i = 0; i < rows.length; i++) {
    // +2: linha 1 é o cabeçalho no CSV/XLSX; em JSON é o deslocamento conhecido
    // do contrato e serve só para apontar a linha no relatório de erros.
    const numeroDaLinha = i + 2;
    const questao = parseQuestion(numeroDaLinha, rows[i]);
    const issues = validateQuestion(questao, tipo);
    if (issues.length > 0) {
      erros.push({ row: numeroDaLinha, message: issues.join("; ") });
      continue;
    }
    const hash = computeHash(questao);
    if (vistos.has(hash)) {
      duplicadas++;
      continue;
    }
    vistos.add(hash);
    validas.push({ row: numeroDaLinha, questao, hash });
  }

  return { validas, erros, duplicadas };
}

export const QuestionImportService = {
  /** Importa questões de um arquivo com validação + dedup + gravação. */
  async importQuestions(
    input: ImportConfig & { file: File }
  ): Promise<ImportResult> {
    const buffer = Buffer.from(await input.file.arrayBuffer());
    return QuestionImportService.importFromBuffer({
      ...input,
      buffer,
      fileName: input.file.name,
      mimeType: input.file.type,
    });
  },

  /**
   * Mesmo caminho de `importQuestions` a partir de bytes, sem depender de
   * `File` — é o que permite rodar o lote da Aula 14 por script.
   */
  async importFromBuffer(
    input: ImportConfig & { buffer: Buffer; fileName: string; mimeType?: string }
  ): Promise<ImportResult> {
    if (input.buffer.byteLength > LIMITE_BYTES) {
      throw new QuestionImportError("FILE_TOO_LARGE", "Arquivo excede o limite de 10 MB.");
    }

    const tipo = input.tipo ?? "multipla_escolha";
    const rows = await rowsFromFile(input.buffer, input.mimeType ?? "", input.fileName);
    if (rows.length === 0) {
      throw new QuestionImportError("EMPTY_FILE", "Nenhuma linha de questão encontrada.");
    }
    if (rows.length > LIMITE_LINHAS) {
      throw new QuestionImportError("TOO_MANY_ROWS", "Máximo de 5000 questões por importação.");
    }

    const { validas, erros, duplicadas } = analisarLote(rows, tipo);
    const result: ImportResult = { imported: 0, skipped: duplicadas, errors: erros };

    for (const { row, questao: q, hash } of validas) {
      try {
        const existing = await QuestionWriteRepository.findByContentHash(hash);
        if (existing) {
          result.skipped++;
          continue;
        }

        const question = await QuestionWriteRepository.createQuestion({
          knowledgeSubjectId: input.subjectId,
          banca: q.banca ?? input.defaultBanca,
          cargo: q.cargo ?? input.defaultCargo,
          ano: q.ano ?? input.defaultAno,
          nivel: q.nivel ?? "medio",
          enunciado: q.enunciado,
          gabarito: q.gabarito,
          explicacao: q.explicacao,
          tipo,
          fonte: q.fonte,
          origin: "import",
          aiGenerated: false,
          needsReview: true,
          topic: q.topic,
          isPublic: false,
          contentHash: hash,
          status: "em_revisao",
        });

        await QuestionWriteRepository.createOptions(
          q.alternativas.map((a) => ({
            questionId: question.id,
            letter: a.letter,
            text: a.text,
            isCorrect: a.letter === q.gabarito,
          }))
        );

        result.imported++;
      } catch (error) {
        result.errors.push({
          row,
          message: error instanceof Error ? error.message : "Falha ao gravar",
        });
      }
    }

    result.errors.sort((a, b) => a.row - b.row);
    return result;
  },

  /**
   * Confere o lote sem tocar em banco: é a contagem que precede a decisão de
   * importar (`--conferir` do script da Aula 14 e o dry-run de testes).
   */
  async conferirLote(input: {
    buffer: Buffer;
    fileName: string;
    mimeType?: string;
    tipo?: TipoImportacao;
  }): Promise<{
    arquivo: string;
    tipo: TipoImportacao;
    linhas: number;
    importaveis: number;
    duplicadasNoLote: number;
    topicos: string[];
    erros: { row: number; message: string }[];
  }> {
    const tipo = input.tipo ?? "multipla_escolha";
    const rows = await rowsFromFile(input.buffer, input.mimeType ?? "", input.fileName);
    const { validas, erros, duplicadas } = analisarLote(rows, tipo);
    return {
      arquivo: input.fileName,
      tipo,
      linhas: rows.length,
      importaveis: validas.length,
      duplicadasNoLote: duplicadas,
      topicos: [
        ...new Set(
          validas
            .map((v) => v.questao.topic)
            .filter((t): t is string => Boolean(t))
        ),
      ].sort(),
      erros,
    };
  },
};
