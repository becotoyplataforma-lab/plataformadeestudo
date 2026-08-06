# 11 — GIT WORKFLOW

> Fluxo de trabalho com Git do projeto.

## Branchs

| Branch | Uso |
| --- | --- |
| `main` | Produção (protegida — sem push direto) |
| `develop` | Integração (opcional) |
| `feature/<nome>` | Novas features (criada a partir de `develop`/`main`) |
| `fix/<nome>` | Correções |
| `hotfix/<nome>` | Correções urgentes em produção |

## Fluxo

1. Criar branch a partir da base:
   `git checkout -b feature/cronograma-inteligente`
2. Commits pequenos e atômicos com **Conventional Commits**:
   - `feat: adiciona X`
   - `fix: corrige Y`
   - `refactor: ...`
   - `docs: ...`
   - `chore: ...`
   - `test: ...`
   - `perf: ...`
3. Push e abrir **Pull Request**.
4. CI roda: `lint + typecheck + test + build`.
5. Revisão e merge (squash) em `main`.

## Regras

- Nunca commitar `.env*` (apenas `.env.example`).
- Nunca commitar `node_modules`, `.next`, `next-env.d.ts`.
- Commit em pt-BR ou inglês — **escolher um e manter** (recomendado: português,
  curto e descritivo).
- Um PR = uma feature/fix.

## Exemplo

```bash
git checkout -b feat/gerar-flashcards-ia
git add .
git commit -m "feat: gera flashcards por IA a partir de um tópico"
git push -u origin feat/gerar-flashcards-ia
```
