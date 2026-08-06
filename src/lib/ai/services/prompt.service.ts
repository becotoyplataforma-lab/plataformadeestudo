/**
 * ConcursoAI — PromptService
 *
 * Construção do prompt do Professor IA (system + histórico + mensagem).
 * Sem RAG, sem documentos — conversa livre (MVP).
 */
import "server-only";
import { prompts, interpolate } from "@/lib/ai/prompts";
import { buildMessages } from "@/lib/ai/deepseek";
import type { ChatMessage as PromptMessage } from "@/lib/ai/types";

export interface PromptContext {
  title?: string;
  subjectName?: string;
}

export const PromptService = {
  /**
   * Monta o system prompt do Professor IA.
   * Interpola os placeholders do arquivo prompts/professor-ia/system.md:
   * {{titulo}}, {{materia}}/{{disciplina}}. {{nivel}}, {{banca}} e {{cargo}}
   * permanecem como placeholders (sem fonte de dados no MVP).
   */
  async buildSystemPrompt(ctx: PromptContext = {}): Promise<string> {
    const base = await prompts.professorSystem();
    return interpolate(base, {
      titulo: ctx.title ?? "ConcursoAI",
      materia: ctx.subjectName ?? "geral",
      disciplina: ctx.subjectName ?? "geral",
    });
  },

  /**
   * Monta a lista de mensagens (system + histórico + user) para o provedor.
   */
  async buildMessages(
    systemPrompt: string,
    history: PromptMessage[],
    userMessage: string
  ): Promise<PromptMessage[]> {
    return buildMessages(systemPrompt, history, userMessage);
  },
};
