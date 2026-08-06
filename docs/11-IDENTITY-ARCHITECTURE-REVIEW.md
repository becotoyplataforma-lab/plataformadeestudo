# 11 — IDENTITY ARCHITECTURE REVIEW

> Análise arquitetural da integração entre Supabase Auth e o domínio Identity.
> Compara duas abordagens e define a arquitetura oficial.
> Nenhum arquivo foi modificado.

---

## CONTEXTO

- O domínio Identity foi modelado (docs 03–08) com `public.users` como raiz.
- O Supabase gerencia identidade em `auth.users`.
- FASE 4 gerou SQL do Identity (database/identity/) com `public.users`, `profiles`, `sessions`.
- Este documento analisa se `public.users` deve existir ou se a identidade deve ser delegada.

---

## OPÇÃO A — auth.users como única fonte da verdade

> Identidade totalmente delegada ao Supabase Auth. `public.profiles` complementar,
> referenciado por `user_id` (= `auth.users.id`).

### Vantagens
- Fonte única de identidade (sem duplicação).
- Login, senha, MFA e recovery gerenciados pelo provedor.
- Auditoria de autenticação nativa do Supabase.
- Padrão oficial e recomendado pelo Supabase.
- Menor superfície de ataque (sem hash de senha na aplicação).

### Desvantagens
- Dependência do Supabase para lógica de identidade.
- Menos controle direto sobre o modelo de autenticação.
- Migrar para outro provedor de auth exigiria adaptação.

### Segurança
- Alta. Hash, brute-force e MFA sob responsabilidade do provedor.

### Performance
- Boa. Consultas por `auth.uid()` são diretas e indexadas.

### Manutenção
- Baixa. Identidade delegada; `profiles` mantido por trigger.

### Compatibilidade com RLS
- Excelente. `auth.uid()` identifica o usuário nativamente.

### Compatibilidade com NextAuth
- Alta. Via adaptador Supabase ou credenciais validadas no Supabase Auth.

### Compatibilidade com Supabase Auth
- Nativa.

### Complexidade
- Baixa a média.

### Escalabilidade
- Alta. Infraestrutura de auth gerida pelo provedor.

### Migrações futuras
- Perfis evoluem sem tocar identidade. Troca de provedor via camada de adaptação.

---

## OPÇÃO B — public.users + auth.users

> Mantém `public.users` (modelo autoral) em paralelo ao `auth.users` do Supabase.

### Vantagens
- Controle total sobre o modelo de usuário.
- Schema autoral independente do provedor.
- Enums e campos próprios de domínio.

### Desvantagens
- Dupla fonte da verdade (email e senha em dois lugares).
- Risco de dessincronização.
- Duplicação de `password_hash` (maior superfície de ataque).
- Custo de sincronização bidirecional.

### Segurança
- Média. Hashes duplicados e fluxo de sync adicional.

### Performance
- Consultas extras para sincronizar; joins adicionais.

### Manutenção
- Alta. Dois fluxos de escrita e de leitura.

### Compatibilidade com RLS
- Possível, mas exige mapeamento `auth.uid() = public.users.id`.

### Compatibilidade com NextAuth
- Possível, mas credenciais validam contra duas fontes.

### Compatibilidade com Supabase Auth
- Exige sincronização bidirecional.

### Complexidade
- Alta.

### Escalabilidade
- Média. Sincronização é potencial gargalo.

### Migrações futuras
- Evitar identidade duplicada depois exige migração custosa.

---

## COMPARAÇÃO RESUMIDA

| Critério | Opção A | Opção B |
| --- | --- | --- |
| Fonte da verdade | Única (auth.users) | Dupla (public + auth) |
| Segurança | Alta | Média |
| Performance | Boa | Média |
| Manutenção | Baixa | Alta |
| RLS | Nativa | Com mapeamento |
| NextAuth | Alta | Média |
| Supabase Auth | Nativa | Com sync |
| Complexidade | Baixa/Média | Alta |
| Escalabilidade | Alta | Média |
| Migrações futuras | Simples | Custosa |

---

## RECOMENDAÇÃO OFICIAL

### Escolha: OPÇÃO A

`auth.users` como única fonte da verdade da identidade.
`public.profiles` como entidade complementar, referenciada por `user_id`
(= `auth.users.id`). Autenticação totalmente delegada ao Supabase Auth.

### Justificativa técnica

1. **Segurança superior:** senha, hash, MFA e proteção contra brute-force
   permanecem sob o provedor, reduzindo superfície de ataque.
2. **RLS nativa:** `auth.uid()` funciona sem mapeamento, tornando as políticas
   mais simples e confiáveis.
3. **Sem dessincronização:** elimina o risco de identidade divergente entre
   `public.users` e `auth.users`.
4. **Compatibilidade:** alinhada ao Supabase Auth e a NextAuth (via adaptador
   ou credenciais validadas no provedor — padrão já usado no código).
5. **Menor manutenção e complexidade:** um único fluxo de escrita de identidade.
6. **Escalabilidade:** infraestrutura de autenticação gerida pelo provedor.
7. **Evolução:** perfis e preferências evoluem livremente sem comprometer a identidade.

---

## ALTERAÇÕES NECESSÁRIAS NO IDENTITY (se aprovado)

Caso a Opção A seja aprovada, os seguintes arquivos deverão ser modificados
(nenhuma modificação foi feita neste momento):

1. `database/identity/schema.sql`
   - Remover a tabela `public.users`.
   - Ajustar `profiles.id` para referenciar `auth.users(id)`.
   - Avaliar `sessions`: delegar ao provedor ou manter com `user_id → auth.users`.
   - Remover enums/campos que ficarem sem uso (revisar `lifecycle_status`).

2. `database/identity/functions.sql`
   - `handle_new_user`: disparar em `AFTER INSERT ON auth.users`.
   - Remover criação de registro em `public.users`.
   - Manter `set_updated_at` e `is_admin` (claim JWT).

3. `database/identity/rls.sql`
   - Remover políticas de `public.users`.
   - Ajustar políticas de `profiles` e `sessions` para `auth.uid()`.

4. `database/identity/seeds.sql`
   - Criar usuários via Supabase Auth (não INSERT em `public.users`).
   - Seeds apenas de `profiles`.

5. `docs/08-DATABASE-PHYSICAL.md`
   - Entidade `USER`: registrar `auth.users` como fonte oficial e ajustar
     a descrição de `profiles`/`sessions` (sem alterar as demais entidades).

6. `docs/06-DOMAIN-DECISIONS.md`
   - Registrar a nova decisão de identidade (DD) referenciando esta revisão.

7. `docs/09-DATABASE-REVIEW.md`
   - Atualizar a observação sobre `public.users` × `auth.users`.

> Observação: `docs/04-DATABASE-LOGICAL.md` e `docs/05-DOMAIN-MODEL.md`
> descrevem `User` no nível de domínio e continuam válidos; apenas o mapeamento
> físico muda (fonte oficial = `auth.users`).
