# SQL manual legado

Os arquivos desta pasta são migrações e seeds SQL manuais históricos.

Não usar estes arquivos para criar novas alterações no banco.

## Fonte oficial

- Schema: `src/db/schema/`
- Gerar migração: `npm run db:generate`
- Verificar migrações: `npm run db:check`
- Aplicar migrações: `npm run db:migrate`
- Migrações geradas: `drizzle/`

Não editar manualmente os arquivos em `drizzle/`. Alterações de schema devem ser feitas em `src/db/schema/` e então geradas com Drizzle Kit.

## Gaps históricos

O SQL legado também pode conter seeds, RLS, índices, funções, views, triggers e extensões que não são representados automaticamente pelo schema Drizzle. Esses objetos devem ser revisados antes de qualquer consolidação operacional.

O baseline gerado pelo schema atual representa as 40 tabelas declaradas em `src/db/schema/`. Ele não deve ser interpretado como substituto automático das políticas RLS, seeds ou objetos auxiliares históricos.
