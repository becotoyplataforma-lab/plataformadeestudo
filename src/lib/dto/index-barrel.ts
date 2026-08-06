/**
 * DTOs (Data Transfer Objects) — contratos de dados nas fronteiras do sistema.
 *
 * Convenções:
 * - Cada módulo tem um arquivo `<modulo>.dto.ts`.
 * - Schema Zod de saída (`XxxDtoSchema`) + tipo inferido (`XxxDto`).
 * - Função mapper `toXxxDto(input: unknown): XxxDto | null` que valida e
 *   normaliza o dado vindo do banco/domínio.
 * - Helpers em `index.ts`: `parseDto`, `strictDto`, `isDto`, `OutputOf`.
 *
 * Regra: TODA nova funcionalidade deve retornar DTOs validados por Zod
 * nas API routes e Server Actions (ver `.ai/04-CODING-RULES.md`).
 */
export * from "./auth.dto";
export * from "./cronograma.dto";
export * from "./questoes.dto";
export * from "./flashcards.dto";
export * from "./chat.dto";
export * from "./analises.dto";
export * from "./pagamentos.dto";
