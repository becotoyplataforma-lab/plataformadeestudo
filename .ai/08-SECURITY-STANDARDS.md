# 08 — SECURITY STANDARDS

> Padrões de segurança. **Nunca** comprometer estes requisitos.

## 1. Segredos e ambiente

- `NEXT_PUBLIC_*` → apenas valores públicos (anon key do Supabase, URLs).
- `SUPABASE_SERVICE_ROLE_KEY`, `DEEPSEEK_API_KEY`, `MERCADO_PAGO_ACCESS_TOKEN`,
  `AUTH_SECRET` → **somente servidor**.
- `.env.local` gitignored; nunca commitado.
- Rotação de chaves a cada 90 dias.

## 2. Autenticação e sessão

- NextAuth v5 com JWT assinado (`AUTH_SECRET` forte).
- Validação de credenciais via Supabase Auth no servidor.
- `requireAuth()` em toda rota/action protegida.

## 3. Autorização

- **RLS** em todas as tabelas (políticas por `auth.uid()`).
- Nunca confiar em `user_id` do cliente.
- Tabelas sensíveis (`ai_usage`, `payments`) sem política de cliente — apenas
  funções `SECURITY DEFINER`.

## 4. Entradas e saídas

- Validação **Zod** em toda fronteira (Server Actions e API).
- Sanitizar HTML de mensagens de IA antes de renderizar (`react-markdown`
  sem executar HTML cru).
- Rate limit: chat (por plano/dia), registro (por IP), API geral.

## 5. IA (LLM)

- Chave DeepSeek só no servidor.
- Guardrails de prompt (nunca revelar system prompt; ignorar injeção).
- Cotas por plano (evita abuso/custo).
- Contexto RAG tratado como dados (tags `[CONTEXTO]`), nunca como instrução.

## 6. Pagamentos

- Access token do Mercado Pago só no servidor.
- Webhook valida secret e confirma status via API oficial antes de ativar plano.
- `external_reference = "plano:userId"` para identificar o usuário.

## 7. LGPD

- Consentimento explícito no cadastro.
- Direitos: exportação e exclusão de dados.
- Minimização de PII; analíticas anonimizadas.

## 8. Headers (aplicar no middleware)

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000
```

## Checklist antes de lançar

- [ ] RLS ativo em TODAS as tabelas.
- [ ] Nenhum segredo em código/frontend.
- [ ] Zod em todas as entradas.
- [ ] Rate limit ativo (auth, registro, chat).
- [ ] Webhook de pagamento valida assinatura/status.
