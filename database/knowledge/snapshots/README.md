# Snapshot do catalogo (somente leitura)

Diretorio: database/knowledge/snapshots
Origem: FASE 2D (linha de base antes da catalogacao historica da FASE 3)

## O que isto e

Um snapshot e uma **fotografia auditavel do estado atual do catalogo** no banco em uso,
gerada por scripts/catalog-snapshot.mjs. Ele existe para que a FASE 3 possa:

1. comparar o antes/depois de cada carga historica sem depender de memoria de console;
2. reproduzir os topicos de edital e os topicos pedagogicos existentes quando o banco de
   desenvolvimento e o mesmo de producao e nao existe staging isolado;
3. provar que nenhuma escrita aconteceu antes da catalogacao.

## O que isto NAO e

- **NAO e seed.** O artefato traz `"seed_compatible": false` de proposito. Nao existe caminho de
  aplicacao: o arquivo nao contem INSERT, UPDATE ou DELETE, nao e migracao Drizzle e nao entra
  em sementeira nenhuma. O projeto tambem nao tem `database/run-seeds.mjs`: a sementeira real e
  `sql/seed.sql`, protegida por `scripts/db-guard.ts`, e ela nao cobre o catalogo atual.
- **NAO substitui a origem editorial.** A autoria continua no Anexo VI do edital e nos
  documentos. O snapshot registra identificadores e grafias, nao direitos.
- **NAO contem credenciais.** URL de conexao, host, project ref, usuario, senha e tokens sao
  redigidos pelo gerador. O campo `database.project_ref` vale sempre `"REDACTED"`.

## Como gerar

```powershell
node --check scripts/catalog-snapshot.mjs
node scripts/catalog-snapshot.mjs --out database/knowledge/snapshots/<aaaa-mm-dd>-<nome>.json
```

Leia credenciais de outro arquivo com `--env-file .env.production`. Substitua um snapshot
existente apenas com `--force` (o arquivo anterior e a unica evidencia da linha de base, entao
prefira gerar um arquivo novo com outra data). Para inspecionar sem gravar: `--stdout`.

## Garantia de somente leitura

O gerador abre **uma unica transacao**, cuja primeira instrucao e `SET TRANSACTION READ ONLY`,
e em seguida executa `SHOW transaction_read_only`. Se a confirmacao nao for `on`, o processo
aborta **sem gravar arquivo algum**. So depois disso roda os `SELECT` das seis tabelas em
allowlist hardcoded (`contests`, `editais`, `knowledge_subjects`, `knowledge_topics`,
`notice_subjects`, `notice_topics`), sempre com `ORDER BY id ASC`, mais as FKs de
`information_schema`. A confirmacao fica registrada no artefato em
`database.read_only_confirmed` e `database.statements_executed`.

O guard de escrita do projeto continua ativo: mesmo que alguem edite o script, `db:push`,
`db:seed`, `db:migrate` e `ingest:apostilas --apply` seguem bloqueados enquanto
`PROD_SUPABASE_PROJECT_REF` e `SAFE_TEST_DATABASE_REFS` estiverem vazios.

## Conteudo do artefato

| bloco | o que registra |
|---|---|
| kind | sempre `catalog-read-only-snapshot` |
| seed_compatible | sempre `false` |
| counts | total e `live` por tabela |
| link_coverage | topicos de edital ligados ou nao ao catalogo pedagogico, com pai, com peso, materias sem topicos |
| analysis | topicos por materia pedagogica e por materia de edital, com nome, `normalized_name` e identificadores |
| relationships | FKs reais das 6 tabelas |
| data | todas as linhas das 6 tabelas, inclusive `deleted_at` nao nulo |
| checksum_sha256 | hash canonico de `data`, para comparar maquinas e momentos |

Atencao: `notice_subjects` nao tem coluna `name`. O nome exibido em
`analysis.notice_topics_per_subject` vem do join com `knowledge_subjects`.

## Linha de base da FASE 2D

Auditoria anterior: 33 materias pedagogicas, 31 topicos pedagogicos, 6 materias de edital,
12 topicos de edital (7 de Portugues + 5 de Matematica). Os 12 estao com `weight = NULL`,
`parent_notice_topic_id = NULL` e `knowledge_topic_id = NULL`: o catalogo de edital esta
**desligado** do catalogo pedagogico. Se um snapshot novo divergir disso sem justificativa
registrada na FASE 3, trate a diferenca como incidente.

## Regras de uso

1. Nunca edite um snapshot a mao. Se a saida estiver errada, gere outro arquivo.

2. Nunca faca commit de snapshot com valores de conexao; confira `database.project_ref`.

3. Um snapshot por marco relevante: antes da FASE 3 e depois de cada carga historica.

4. Nome de arquivo comeca com data ISO, por exemplo `2026-10-03-catalogo-atual.json`.

5. Snapshot nao e backup nem substitui restore: e prova de **estado** do catalogo. 
