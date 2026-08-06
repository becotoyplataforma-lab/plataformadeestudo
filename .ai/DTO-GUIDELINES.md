# DTO Guidelines

> Guia definitivo para uso de **DTOs** no ConcursoAI Platform.
> Regra oficial: **toda funcionalidade nova usa DTO + Zod + Repository + Service + Mapper.**

## 1. O que é um DTO

**DTO (Data Transfer Object)** é o contrato de dados que cruza as **fronteiras**
do sistema (API routes e Server Actions). Ele:

- Define exatamente o que entra/sai (nunca expõe a entidade do banco "crua").
- Remove campos sensíveis/internos (ex.: `user_id` de tabelas internas, chaves).
- Normaliza o formato (JSON `snake_case` em pt-BR).
- É **validado por Zod** — se os dados não conformarem, a fronteira falha/loga.

| Conceito | Papel |
| --- | --- |
| Tipo de domínio (`src/types`) | Modelo de negócio (dentro do app) |
| Linha do banco (row) | Dados brutos do Supabase |
| **DTO** (`src/lib/dto`) | Contrato de fronteira (o que o cliente vê) |

## 2. Estrutura de um DTO

Cada módulo tem um arquivo `src/lib/dto/<modulo>.dto.ts` com 3 partes:

```ts
import { z } from "zod";
import { parseDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";

// 1) Schema Zod de saída (fonte da verdade do contrato)
export const StudyTaskDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  subject_id: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration_min: z.number().int().min(0),
  status: z.enum(["pendente", "concluida", "adiada"]),
  completed_at: z.string().nullable(),
});

// 2) Tipo inferido
export type StudyTaskDto = OutputOf<typeof StudyTaskDtoSchema>;

// 3) Mapper: valida + normaliza (entidade/banco → DTO)
export function toStudyTaskDto(input: unknown): StudyTaskDto | null {
  return parseDto(StudyTaskDtoSchema, input);
}

// Para listas
export function toStudyTaskDtoList(input: unknown[]): StudyTaskDto[] {
  return input
    .map((row) => toStudyTaskDto(row))
    .filter((dto): dto is StudyTaskDto => dto !== null);
}
```

## 3. Helpers (em `src/lib/dto/index.ts`)

| Helper | Comportamento | Quando usar |
| --- | --- | --- |
| `parseDto(schema, data)` | Retorna `T \| null` (loga se inválido) | Quando o erro é tolerável / resposta opcional |
| `strictDto(schema, data)` | Retorna `T` ou **lança** | Fail-fast no servidor (dados devem conformar sempre) |
| `isDto(schema, data)` | Type guard `data is T` | Checagens condicionais |
| `OutputOf<T>` | Tipo = `z.infer` do schema | Definir `type XxxDto` |
| `pick` / `omit` | Seleciona/remove campos | Construir DTO sem campos sensíveis |

## 4. Regras obrigatórias

1. **Nunca** retornar entidade/row do banco diretamente na resposta — sempre `toXxxDto`.
2. **Nunca** expor campos sensíveis no DTO (chaves, `service_role`, dados internos).
3. Todo schema Zod de DTO usa `z` (sem `z.any()`); para campos desconhecidos usar
   `z.unknown()` ou `.passthrough()` com consciência — preferir **whitelist**.
4. Mappers recebem `unknown` e fazem a **validação na fronteira** (defensivo contra
   mudanças de schema do banco).
5. DTO de **saída** fica em `src/lib/dto`; DTO de **entrada** (validação do request)
   fica em `src/lib/validations` (Zod).
6. Listas: sempre fornecer `toXxxDtoList` com type guard.
7. Relações aninhadas (ex.: `subject` dentro de tarefa) são incluídas no DTO como
   `nullable().optional()` e mapeadas pelo mapper.

## 5. Exemplo completo (nova feature)

```
POST /api/exemplo
  → valida entrada com Zod (src/lib/validations/exemplo.ts)
  → chama Service (src/lib/services/exemplo.service.ts)
      → Service chama Repository (src/lib/db/repositories/exemplo.ts)
      → Repository retorna row
  → Service chama Mapper toExemploDto(row)
  → retorna apiOk(dto)  // DTO validado
```

```ts
// route.ts (novo)
export async function GET() {
  const { userId } = await requireAuth();
  const rows = await exemploRepository.list(db, userId); // dados
  return apiOk(toExemploDtoList(rows));                   // DTO validado
}
```

## 6. Código legado

- Rotas/actions atuais **não migradas** podem permanecer até manutenção.
- Ao tocar um trecho legado, aplique DTO naquela alteração.
- NÃO migrar rotas existentes por fora do escopo da tarefa.

## 7. Boas práticas

- Nome de arquivo: `<modulo>.dto.ts` · Schema: `XxxDtoSchema` · Tipo: `XxxDto` · Mapper: `toXxxDto`.
- Mensagens de validação do DTO em **pt-BR** quando forem exibidas ao usuário.
- DTOs não contêm lógica de negócio (apenas validação/normalização).
- Documentar o DTO quando o contrato for estável (ver `docs/05-API.md`).

## 8. Referência

- Helpers: `src/lib/dto/index.ts`
- DTOs existentes: `src/lib/dto/*.dto.ts` (auth, cronograma, questoes, flashcards,
  chat, analises, pagamentos)
- Entrada (Zod): `src/lib/validations/*`
- Regras: `.ai/04-CODING-RULES.md`, `.ai/07-API-STANDARDS.md`
