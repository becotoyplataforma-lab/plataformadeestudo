/**
 * ConcursoAI — Metadata helpers (funções puras testáveis)
 *
 * Extração de referências legais, detecção de idioma e keywords.
 * Sem dependências de banco — testável em isolamento.
 */

export interface LegalReference {
  law: string;
  article?: string;
  paragraph?: string;
  rawText: string;
}

const LEGAL_PATTERNS: { regex: RegExp; law: string }[] = [
  {
    regex: /Art\.\s*\d+[º°]?\s*(,?\s*(§\s*\d+[º°]?|inciso\s+[IVXLC]+))?\s*(da|do|de)?\s*(Constitui[cç][aã]o\s*Federal|CF\/88|CRFB\/88)/gi,
    law: "Constituição Federal",
  },
  {
    regex: /Lei\s*(n\.?|n[º°]|no\.?)?\s*([\d.]+)\/(\d{2,4})/gi,
    law: "Lei",
  },
  {
    regex: /S[úu]mula\s*(Vinculante\s*)?(\d+)\s*(do\s*)?(STF|STJ|TST)/gi,
    law: "Súmula",
  },
  {
    regex: /Decreto\s*(n\.?|n[º°]|no\.?)?\s*([\d.]+)\/(\d{2,4})/gi,
    law: "Decreto",
  },
];

/** Extrai referências legais de um texto (máx. 20). */
export function extractLegalReferences(text: string): LegalReference[] {
  const refs: LegalReference[] = [];
  for (const { regex, law } of LEGAL_PATTERNS) {
    const matches = text.matchAll(regex);
    for (const match of matches) {
      refs.push({
        law,
        article: match[2] ?? undefined,
        rawText: match[0],
      });
    }
  }
  return refs.slice(0, 20);
}

/** Detecta idioma (default pt-BR; heurística simplificada). */
export function detectLanguage(text: string): string {
  const ptPatterns = /[ãõáéíóúâêîôûàèìòùç]/gi;
  const matches = text.match(ptPatterns);
  return matches && matches.length > text.length * 0.01 ? "pt-BR" : "pt-BR";
}

/** Extrai palavras-chave por frequência (máx. maxKeywords). */
export function extractKeywords(text: string, maxKeywords = 10): string[] {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const freq: Record<string, number> = {};

  const stopWords = new Set([
    "de", "da", "do", "das", "dos", "e", "a", "o", "as", "os",
    "em", "no", "na", "nos", "nas", "para", "com", "que", "se",
    "não", "é", "foi", "ser", "um", "uma", "por", "ao",
  ]);

  for (const word of words) {
    const clean = word.replace(/[^a-záàâãéèêíïóôõöúçñ]+/g, "");
    if (clean.length < 3 || stopWords.has(clean)) continue;
    freq[clean] = (freq[clean] || 0) + 1;
  }

  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxKeywords)
    .map(([word]) => word);
}
