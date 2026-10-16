/**
 * Cliente de IA falso para os testes do agente (FASE 4B).
 *
 * Le o proprio prompt enviado por `buildCatalogAiPrompt` e devolve uma proposta por
 * candidato, com id canonico inexistente quando `suggestIds` fica vazio: assim o
 * teste exercita o caminho inteiro (pedido, resposta, validacao de schema, anotacao)
 * sem tocar em rede, chave de ambiente ou provedor real.
 */
import type { CatalogAiClient, CatalogAiPrompt } from "../../services/ai-proposal.service";

export interface FakeCatalogAiClient extends CatalogAiClient {
  /** Prompt da ultima chamada, para assercao de tamanho/ancoras. */
  prompts: CatalogAiPrompt[];
}

function candidateLines(user: string): string[] {
  const start = user.indexOf("CANDIDATOS");
  if (start === -1) return [];
  return user.slice(start).split("\n").slice(1).filter((line) => line.split("|").length === 4);
}

export function fakeCatalogClient(confidence = 0.5, suggestIds: Record<string, string> = {}): FakeCatalogAiClient {
  const prompts: CatalogAiPrompt[] = [];
  return {
    provider: "deepseek",
    model: "fake-deepseek-catalog",
    prompts,
    async complete(prompt: CatalogAiPrompt): Promise<string> {
      prompts.push(prompt);
      const proposals = candidateLines(prompt.user).slice(0, 300).map((line, index) => {
        const parts = line.split("|").map((part) => part.trim());
        const candidateId = parts[1] ?? "";
        const suggestion = suggestIds[candidateId];
        return {
          candidate_id: candidateId,
          candidate_index: index,
          suggested_canonical_topic_id: suggestion ?? null,
          justification: suggestion
            ? "Mesmo conteudo publicado, nome com outra grafia."
            : "Nada correspondente no catalogo lido.",
          confidence,
        };
      });
      return JSON.stringify({ proposals });
    },
  };
}