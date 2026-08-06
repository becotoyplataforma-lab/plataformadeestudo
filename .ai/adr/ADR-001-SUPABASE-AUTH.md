# ADR-001 - Supabase Auth como fonte oficial de identidade

## Status
Accepted

## Context
- O domínio Identity foi modelado com uma tabela própria `public.users`.
- O Supabase gerencia identidade em `auth.users` (login, senha, MFA, recovery).
- Manter `public.users` em paralelo criava dupla fonte da verdade e risco de dessincronização.
- A análise `docs/11-IDENTITY-ARCHITECTURE-REVIEW.md` comparou as abordagens.

## Decision
- `auth.users` é a única fonte oficial de identidade.
- `public.users` deixa de existir.
- `public.profiles` referencia `auth.users(id)` e contém apenas dados complementares.
- Toda autenticação é responsabilidade exclusiva do Supabase Auth.
- Sessions internas existem somente se houver necessidade funcional além do Supabase Auth.
- RLS usa `auth.uid()` nativamente.

## Consequences
- Identidade sem duplicação e sem dessincronização.
- RLS simplificada via `auth.uid()`.
- `profiles` criado por trigger em `auth.users`.
- Dependência do Supabase para lógica de autenticação.
- SQL do Identity gerado anteriormente (database/identity/) precisa ser revisado na próxima manutenção (não alterado nesta decisão).

## Benefits
- Segurança superior (hash, MFA e brute-force sob o provedor).
- Menor manutenção e complexidade.
- Compatibilidade nativa com Supabase Auth e NextAuth.
- Escalabilidade gerida pelo provedor.

## Trade-offs
- Acoplamento ao Supabase Auth.
- Menos controle direto sobre o modelo de autenticação.
- Troca de provedor exige camada de adaptação.

## Alternatives Considered
- OPÇÃO B: `public.users` + `auth.users` em paralelo (rejeitada — duplicação e complexidade).
- Manter apenas `public.users` sem Supabase Auth (rejeitada — perde recursos de segurança do provedor).

## Migration Strategy
- Nenhuma migração SQL aplicada por esta decisão.
- Na próxima manutenção do domínio Identity:
  - Remover `public.users` do schema.
  - `profiles.id` passa a referenciar `auth.users(id)`.
  - `handle_new_user` passa a disparar em `auth.users`.
  - Políticas RLS ajustadas para `auth.uid()`.
- Código existente será adaptado quando sofrer manutenção (política de legado).

## References
- docs/11-IDENTITY-ARCHITECTURE-REVIEW.md
- docs/06-DOMAIN-DECISIONS.md (DD-019)
- docs/08-DATABASE-PHYSICAL.md (entidade USER)
