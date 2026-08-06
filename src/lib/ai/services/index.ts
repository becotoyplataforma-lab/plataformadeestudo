/**
 * ConcursoAI — AI Services (barrel export)
 */
export { ChatService, ChatError } from "./chat.service";
export { PromptService } from "./prompt.service";
export {
  UsageService,
  UsageError,
  USD_TO_BRL,
} from "./usage.service";
export { ModelRouterService, ModelRouterError } from "./model-router.service";
export { DeepSeekProvider, ProviderError } from "./deepseek-provider.service";
export {
  RagService,
  ragService,
  RagError,
  type RagDependencies,
  type RagInput,
  type RagOutput,
  type Citation,
  type RagTokens,
} from "./rag.service";
export {
  ProfessorService,
  professorService,
  ProfessorError,
  defaultResolveIntent,
  DEFAULT_USAGE_LIMIT,
  type ProfessorDependencies,
  type ProfessorInput,
  type ProfessorOutput,
  type ProfessorMode,
  type ProfessorIntent,
} from "./professor.service";
