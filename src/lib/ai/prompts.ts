import "server-only";
import { promises as fs } from "fs";
import path from "path";

/**
 * Carregador de prompts versionados na pasta /prompts.
 * Cache em memória para evitar leituras repetidas de disco.
 */

const PROMPTS_ROOT = path.join(process.cwd(), "prompts");

/**
 * Cache por mtime, nao por caminho apenas.
 *
 * A versao anterior guardava o conteudo para sempre: editar um prompt so valia
 * depois de reiniciar o processo, e "regra editavel sem redeploy" virava
 * "regra editavel com restart". Trocar o prompt e mais barato que trocar o
 * codigo; medir o arquivo no disco a cada leitura mantem isso verdade.
 */
const cache = new Map<string, { content: string; mtimeMs: number }>();

async function loadPrompt(relativePath: string): Promise<string> {
  const filePath = path.join(PROMPTS_ROOT, relativePath);
  try {
    const stat = await fs.stat(filePath);
    const cached = cache.get(relativePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.content;
    const content = await fs.readFile(filePath, "utf-8");
    cache.set(relativePath, { content, mtimeMs: stat.mtimeMs });
    return content;
  } catch (error) {
    // Arquivo ilegível agora: se já existiu, serve a última cópia boa em vez de
    // derrubar uma geração inteira por um erro transitório de disco.
    const cached = cache.get(relativePath);
    if (cached) return cached.content;
    throw error;
  }
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
  apostilaTransformar: () => loadPrompt("apostila/transformar.md"),
  apostilaEstruturarFases: () => loadPrompt("apostila/estruturar-fases.md"),
};
