/**
 * DeepSeekCatalogAiClient (FASE 4B) - adapter concreto do contrato da FASE 4.
 *
 *   CatalogAiClient  <-  esta classe  ->  DeepSeekProvider -> @/lib/ai/deepseek
 *
 * O dominio do catalogo continua vendo somente `complete(prompt): Promise<string>`
 * (a porta criada na FASE 4). Este arquivo e o unico lugar do dominio que conhece
 * o provedor: nao ha segunda configuracao de IA, segunda base de URL nem segundo
 * schema de chave. A chave continua sendo `DEEPSEEK_API_KEY` de `@/lib/env`, a mesma
 * que `@/lib/ai/deepseek` ja le.
 *
 * Modelo: `flash` (deepseek-chat). Motivo pratico, o mesmo registrado em
 * `apostila-transform.service.ts`: o `deepseek-reasoner` gasta tokens de saida no
 * raciocinio interno e pode devolver `content` vazio em prompt longo. Anotacao de
 * catalogo e tarefa de extracao curta, nao de raciocinio.
 *
 * Este adapter NAO devolve autoridade ao modelo: quem decide classificacao continua
 * sendo `catalog-matcher.service.ts`. Erro aqui vira rejeicao `AI_PROVIDER_FAILED`
 * na camada de proposta, nunca uma mudanca de decisao.
 */
import "server-only";
import { DeepSeekProvider } from "@/lib/ai/services/deepseek-provider.service";
import { MODEL_NAMES, MODEL_PARAMS, type AIModel } from "@/lib/ai/types";
import { env } from "@/lib/env";
import type { CatalogAiClient, CatalogAiPrompt } from "./ai-proposal.service";

/** Modelo do dominio de catalogo: flash = deepseek-chat. */
export const CATALOG_AI_MODEL: AIModel = "flash";

/** Teto de espera: sem ele o agente fica preso num provedor lento. */
export const CATALOG_AI_TIMEOUT_MS = 45000;

/** Temperatura baixa: anotacao de catalogo tem que ser reprodutive. */
export const CATALOG_AI_TEMPERATURE = 0;

export type CatalogAiClientErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_TIMEOUT"
  | "AI_PROVIDER_FAILED"
  | "AI_EMPTY_RESPONSE";

/**
 * Erro com codigo fixo e mensagem propria: a mensagem crua do provedor fica no log
 * do DeepSeekProvider e nunca sobe para o relatorio, que pode ser exibido a usuario.
 */
export class CatalogAiClientError extends Error {
  readonly code: CatalogAiClientErrorCode;
  constructor(code: CatalogAiClientErrorCode, message: string) {
    super(message);
    this.name = "CatalogAiClientError";
    this.code = code;
  }
}

export interface DeepSeekCatalogAiOptions {
  model?: AIModel;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}

/** A mesma checagem que `@/lib/ai/deepseek` faz antes de abrir conexao. */
export function isDeepSeekCatalogConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim() || env.DEEPSEEK_API_KEY);
}

export class DeepSeekCatalogAiClient implements CatalogAiClient {
  readonly provider = "deepseek" as const;
  readonly model: string;

  private readonly aiModel: AIModel;
  private readonly timeoutMs: number;
  private readonly temperature: number;

  constructor(options: DeepSeekCatalogAiOptions = {}) {
    this.aiModel = options.model ?? CATALOG_AI_MODEL;
    this.model = MODEL_NAMES[this.aiModel];
    this.timeoutMs = options.timeoutMs ?? CATALOG_AI_TIMEOUT_MS;
    this.temperature = options.temperature ?? CATALOG_AI_TEMPERATURE;
  }

  /** Leitura do ambiente de execucao; em teste se injeta um cliente falso. */
  isConfigured(): boolean {
    return isDeepSeekCatalogConfigured();
  }

  /**
   * Chama o provedor existente e devolve o texto cru. Valida schema, JSON e
   * excesso de autoridade e atribuicao de `ai-proposal.service.ts`, nao daqui.
   */
  async complete(prompt: CatalogAiPrompt): Promise<string> {
    if (!this.isConfigured()) {
      throw new CatalogAiClientError(
        "AI_NOT_CONFIGURED",
        "DEEPSEEK_API_KEY ausente: nenhuma proposta de IA sera enviada."
      );
    }
    const maxTokens = Math.max(
      prompt.maxTokens ?? MODEL_PARAMS[this.aiModel].maxTokens,
      256
    );
    const task = DeepSeekProvider.complete({
      model: this.aiModel,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      temperature: this.temperature,
      maxTokens,
    });
    // Se o timeout ganhar, a promessa original continua em aberto: o handler acima
    // impede rejection nao tratada, nao engole erro do relatorio.
    task.catch(() => undefined);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new CatalogAiClientError("AI_TIMEOUT", "O provedor nao respondeu dentro do prazo."));
      }, this.timeoutMs);
    });

    try {
      const result = await Promise.race([task, deadline]);
      const content = result.content?.trim() ?? "";
      if (content.length === 0) {
        throw new CatalogAiClientError(
          "AI_EMPTY_RESPONSE",
          "O provedor respondeu sem conteudo: nada foi proposto."
        );
      }
      return content;
    } catch (error) {
      if (error instanceof CatalogAiClientError) throw error;
      // Regra da casa (AGENTS.md): erro nao-dominiado vira mensagem fixa. O texto
      // cru do provedor pode trazer host, quota ou credencial e fica apenas no log
      // do DeepSeekProvider, nunca no payload que sai para o admin.
      throw new CatalogAiClientError(
        "AI_PROVIDER_FAILED",
        "O provedor DeepSeek falhou; nenhuma sugestao entrou no relatorio."
      );
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}

/**
 * Fabrica de borda: devolve cliente real quando ha chave, `null` quando nao. O
 * agente trata `null` exatamente como a FASE 4 ja trata: secao de IA fica
 * `AI_CLIENT_UNAVAILABLE`, sem rede e sem escrita.
 */
export function createDeepSeekCatalogAiClient(
  options: DeepSeekCatalogAiOptions = {}
): CatalogAiClient | null {
  if (!isDeepSeekCatalogConfigured()) return null;
  return new DeepSeekCatalogAiClient(options);
}