import "server-only";
import { promises as fs } from "fs";
import path from "path";

/**
 * Carregador de prompts versionados na pasta /prompts.
 * Cache em memória para evitar leituras repetidas de disco.
 */

const PROMPTS_ROOT = path.join(process.cwd(), "prompts");

const cache = new Map<string, string>();

async function loadPrompt(relativePath: string): Promise<string> {
  if (cache.has(relativePath)) return cache.get(relativePath)!;
  const filePath = path.join(PROMPTS_ROOT, relativePath);
  const content = await fs.readFile(filePath, "utf-8");
  cache.set(relativePath, content);
  return content;
}

/** Substitui placeholders {{variavel}} no prompt. */
export function interpolate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    vars[key] !== undefined ? vars[key] : `{{${key}}}`
  );
}

export const prompts = {
  professorSystem: () => loadPrompt("professor-ia/system.md"),
  explicarQuestao: () => loadPrompt("professor-ia/questao.md"),
  gerarCronograma: () => loadPrompt("professor-ia/cronograma.md"),
  resumoTopico: () => loadPrompt("professor-ia/resumo.md"),
  gerarSimulado: () => loadPrompt("professor-ia/simulado.md"),
  correcaoRedacao: () => loadPrompt("professor-ia/redacao.md"),
  flashcardsGerar: () => loadPrompt("flashcards/gerar.md"),
  etlExplicarQuestao: () => loadPrompt("etl/explicar-questao.md"),
  diagnostico: () => loadPrompt("analytics/diagnostico.md"),
};
