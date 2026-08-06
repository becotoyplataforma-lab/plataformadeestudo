# 14 — ERROR HANDLING

> Padrões de tratamento de erros. O usuário nunca deve ver um erro cru.

## Principios

1. Nenhuma exceção "estoura" para a UI.
2. Erros são **tipados/estruturados** e exibidos em **pt-BR**.
3. Logs no servidor com contexto (nunca PII sensível).

## Server Actions

```ts
type ActionResult = { success: boolean; message: string };

// Sempre retorna, nunca lança para o cliente
export async function actionCreateTask(input: unknown): Promise<ActionResult> {
  try {
    const userId = await requireUser();
    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    // ... persistência
    revalidatePath("/modulo");
    return { success: true, message: "Sucesso!" };
  } catch (error) {
    console.error("[modulo] operacao", error);
    return { success: false, message: "Erro ao executar operação." };
  }
}
```

## API Routes

```ts
import { requireAuth, apiOk, apiError } from "@/lib/api/helpers";

export async function POST(req: Request) {
  try {
    const { userId } = await requireAuth(); // 401 se não autenticado
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);  // 422
    if (!parsed.success) return apiError(422, "Dados inválidos");
    // ...
    return apiOk({ data });
  } catch (error) {
    console.error("[modulo] POST", error);
    return apiError(500, "Erro interno.");
  }
}
```

## Códigos de status

Ver `07-API-STANDARDS.md` (400/401/403/404/409/422/429/500).

## Cliente (UI)

- `toast.success()` / `toast.error()` via **sonner**.
- Formulários: mensagem de erro por campo (estado local).
- Estados de carregamento com `Loader2` + `animate-spin`.

## Streaming / IA

- `/api/chat` envia evento `error` no SSE e salva fallback amigável.
- Cotas: retorna `429` com mensagem de plano.

## Webhooks (Mercado Pago)

- Sempre responder `200` (mesmo em erro) para evitar retries infinitos.
- Logar o erro interno.

## Logging

- `console.error("[modulo] contexto", error)` no servidor.
- Sentry (futuro) para rastreio em produção.
- Nunca logar senhas, tokens ou chaves.
