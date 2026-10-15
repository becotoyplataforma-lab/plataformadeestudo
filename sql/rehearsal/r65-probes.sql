-- ============================================================
-- R6.5 - Ensaio estatico de leitura de catalog (PostgreSQL 17)
-- ============================================================
--
-- Este arquivo NAO FOI EXECUTADO. E a especificacao SQL do ensaio, para
-- revisao estatica antes de qualquer gate de execucao.
--
-- Rotulos obrigatorios em cada bloco:
--   [E] = entra no digest de assinatura; participa da comparacao entre bancos.
--   [P] = prova de cobertura/aborto. Resultado inesperado ABORTA o host antes
--         de qualquer digest. [P] nao entra no digest.
--   [C] = conceitual, sem SQL. NAO pode ser declarado como coberto.
--
-- Politica de assinatura:
--   * O SQL so produz texto de token. digest(), sha256() e qualquer hash
--     ficam no host: o banco nunca calcula a assinatura.
--   * OID cru nao entra em token [E]. Ou o nome e resolvido por funcao oficial
--     (pg_get_indexdef, pg_get_function_arguments, format_type), ou o token sai
--     <opaque> e o host aborta.
--   * Vetores de catalog (int2vector / oidvector) nao sao arrays: nunca vao
--     para unnest(). So aparecem em bloco [P], como evidencia opaca.
--
-- Sentinelas fechadas (nenhuma outra palavra e permitida):
--   <absent> campo que nao existe na natureza daquele objeto
--   <none>   coluna presente sem valor atribuido (S0)
--   <null>   SQL NULL em coluna realmente nullable (S)
--   <empty>  texto presente com comprimento zero
--   <opaque> OID sem resolucao de nome: aborta antes do digest
--   <ambiguous> dependencia com mais de um dono possivel: aborta antes do digest
--   <unknown> qualquer outro caso: aborta antes do digest
--
-- Correcoes desta revisao sobre a R6.5 (travadas por teste estatico em
--   src/lib/db/__tests__/r65-rehearsal-sql.test.ts):
--   pg_catalog.coalesce(...)        -> CASE, pois COALESCE nao e funcao ordinaria
--   HDL(...)                        -> HXL(...) ou removido
--   unnest(i.indclass/indcollation) -> removido: vetor de catalog nao e anyarray
--   i.indhasindex                   -> removido: nao existe em pg_index
--   p.probin como bytea             -> text
--   p.proargdefaults como array     -> pg_node_tree; lido por
--                                    pg_get_function_arguments, nunca por unnest
--   sequence_last_value() e         -> view pg_sequences.last_value; nenhuma dessas
--     sequence_concealed_value()       funcoes existe no PostgreSQL 17
--   ascii_chr()                     -> removido: nao existe no PostgreSQL 17
--   relam assinado em todo objeto   -> assinado so onde ha access method

-- ------------------------------------------------------------
-- [E] FUNCOES AUXILIARES
-- ------------------------------------------------------------

-- S: NULL de coluna nullable vira <null>.
CREATE TEMPORARY FUNCTION S(v anyelement)
  RETURNS text
  LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN v IS NULL THEN '<null>'
    WHEN text(v) = '' THEN '<empty>'
    ELSE text(v)
  END
$fn$;

-- S0: coluna presente sem valor atribuido vira <none>. A diferenca entre S e S0
-- e o que separa NULL de ausencia real, e isso que a R6.5 perdeu no gatilho.
CREATE TEMPORARY FUNCTION S0(v anyelement)
  RETURNS text
  LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN v IS NULL THEN '<none>'
    WHEN text(v) = '' THEN '<empty>'
    ELSE text(v)
  END
$fn$;

-- HXL: renderizador canonico de escalar de catalog que nao e array, incluindo
-- vetores. Usa text(v), a saida oficial do tipo; jamais unnest().
CREATE TEMPORARY FUNCTION HXL(v anyelement)
  RETURNS text
  LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN v IS NULL THEN '<none>'
    ELSE text(v)
  END
$fn$;

-- ------------------------------------------------------------
-- [P] ST-FUNC - as auxiliares existem e separam NULL de ausencia
-- Esperado: uma linha, todas as colunas true.
-- Aborto: zero linhas, ou qualquer coluna false.
-- ------------------------------------------------------------
SELECT
  S(NULL::int)             = '<null>'   AS s_null,
  S0(NULL::int)            = '<none>'   AS s0_null,
  S(''::text)             = '<empty>'  AS s_empty,
  HXL(NULL::oidvector)     = '<none>'   AS hxl_null_vector,
  HXL('1 3'::int2vector)  = '1 3'      AS hxl_vector_text
;

-- ------------------------------------------------------------
-- [E] Q-SCOPE - GUCs de escopo (diagnostico de preparo, nao de cobertura)
-- ------------------------------------------------------------
SELECT
  current_setting('search_path', true) AS raw_search_path,
  current_schema(true)                 AS effective_schema,
  version()                            AS server_version
;

-- ------------------------------------------------------------
-- [P] Q-SCOPE-ASSERT - escopo valido ANTES de ler qualquer classe
-- Escopo invalido e erro de preparo: nao confundir com classe vazia.
-- Esperado: uma linha com ok = true.
-- Aborto: zero linhas, ou ok = false.
-- ------------------------------------------------------------
SELECT
  CASE
    WHEN coalesce(trim(' ' FROM current_setting('search_path', true)), '') = ''
      THEN false
    WHEN current_schema(true) IS NULL THEN false
    ELSE true
  END AS ok,
  current_schema(true) AS resolved_schema
;

-- ------------------------------------------------------------
-- [E] C1 - relacoes do escopo, uma linha por objeto
-- Sequencia (S) fica em C1S e indice (i) fica em C4: a exclusao aqui e o que
-- impede a contagem dupla que a R6.5 tinha. P-CLASS-NATTS prova a particao.
-- relam so e assinado onde existe access method; em view e sequencia nao ha.
-- ------------------------------------------------------------
SELECT
  'R|' || n.nspname || '|' || c.relname || '|' || c.relkind || '|' ||
  CASE
    WHEN c.relkind IN ('r', 'p', 'm', 't')
      THEN am.amname
    ELSE '<absent>'
  END || '|' ||
  CASE WHEN c.relkind IN ('r', 'p', 'm')
    THEN c.relnatts::text ELSE '<absent>' END || '|' ||
  CASE WHEN c.relkind = 'p' THEN coalesce(
         pg_get_expr(c.relpartbound, c.oid, true), '<none>')
    ELSE '<absent>' END AS token
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_am am ON am.oid = c.relam
WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f', 't')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg\_toast%'
  AND n.nspname NOT LIKE 'pg\_temp%'
ORDER BY token
;

-- ------------------------------------------------------------
-- [E] C1A - atributos, uma linha por coluna de relacao do escopo
-- Tipo por format_type (nome, nunca OID). Default por pg_get_expr, porque
-- adbin e pg_node_tree e texto cru de arvore nao e evidencia comparavel.
-- Coluna droplada fica fora de assinatura mas entra na contagem de cobertura.
-- ------------------------------------------------------------
SELECT
  'A|' || n.nspname || '|' || c.relname || '|' || a.attname || '|' ||
  format_type(a.atttypid, a.atttypmod) || '|' ||
  CASE WHEN a.attnotnull THEN 'notnull' ELSE 'null' END || '|' ||
  coalesce(pg_get_expr(d.adbin, d.adrelid), '<none>') || '|' ||
  CASE a.attidentity
    WHEN '' THEN '<none>'
    ELSE a.attidentity
  END || '|' ||
  CASE a.attgenerated
    WHEN '' THEN '<none>'
    ELSE a.attgenerated
  END AS token
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE a.attnum > 0
  AND NOT a.attisdropped
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 't')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg\_toast%'
ORDER BY token
;

-- ------------------------------------------------------------
-- [E] C1S - sequencias do escopo
-- Ultima via documental no PG17: a view pg_sequences. Nao existe
-- sequence_last_value() nem sequence_concealed_value() no catalogo de funcoes.
-- last_value e estado fisico (depende de nextval ja ter corrido): fica FORA do
-- token assinado, senao dois bancos iguais nunca assinam igual.
-- Dependencia ambigua nao e filtrada para sumir: vira <ambiguous> e o host
-- aborta antes do digest, porque adivinhar o dono da sequencia seria fraude.
-- ------------------------------------------------------------
SELECT
  'Q|' || n.nspname || '|' || c.relname || '|' ||
  coalesce(seq.data_type::text, '<none>') || '|' ||
  coalesce(seq.start_value::text, '<none>') || '|' ||
  coalesce(seq.increment_by::text, '<none>') || '|' ||
  coalesce(seq.min_value::text, '<none>') || '|' ||
  coalesce(seq.max_value::text, '<none>') || '|' ||
  CASE WHEN seq.cache_size IS NULL THEN '<none>'
    ELSE seq.cache_size::text END || '|' ||
  CASE WHEN seq.cycle THEN 'cycle' ELSE 'nocycle' END || '|' ||
  CASE
    WHEN dep.found IS NULL THEN 'standalone'
    WHEN dep.found = 1 THEN dep.owner_kind
    ELSE '<ambiguous>'
  END AS token
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_sequences seq
  ON seq.schemaname = n.nspname AND seq.sequencename = c.relname
LEFT JOIN LATERAL (
  SELECT
    count(*) AS found,
    max(CASE
      WHEN d.deptype = 'a' THEN 'identity-column'
      WHEN d.deptype = 'x' THEN 'owned-by-column'
      ELSE '<unknown>'
    END) AS owner_kind
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = c.oid
) dep ON TRUE
WHERE c.relkind = 'S'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY token
;

-- ------------------------------------------------------------
-- [E] C2 - constraints
-- pg_get_constraintdef devolve a definicao com nomes resolvidos; convalidated
-- fica visivel porque constraint INVALIDA e estrutura diferente de VALIDA.
-- ------------------------------------------------------------
SELECT
  'K|' || n.nspname || '|' || c.relname || '|' || con.conname || '|' ||
  CASE con.contype
    WHEN 'p' THEN 'primary'
    WHEN 'u' THEN 'unique'
    WHEN 'f' THEN 'foreign'
    WHEN 'c' THEN 'check'
    WHEN 'x' THEN 'exclusion'
    ELSE '<unknown>'
  END || '|' ||
  coalesce(pg_get_constraintdef(con.oid), '<none>') || '|' ||
  CASE WHEN con.convalidated THEN 'validated' ELSE 'unvalidated' END || '|' ||
  CASE WHEN con.coninhcount = 0 THEN 'native'
    ELSE 'inherited' END AS token
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY token
;

-- ------------------------------------------------------------
-- [E] C4 - indices
-- Correcao central: pg_index NAO tem indhasindex (relhasindex e de pg_class).
-- indkey / indcollation / indclass / indoption sao int2vector e oidvector, que
-- NAO sao anyarray: passam por pg_get_indexdef, que resolve AM, colunas,
-- operador de ordem, NULLS FIRST/LAST, opclass e collacao por nome.
-- Predicado parcial sai por pg_get_expr(indpred, indrelid), nao por texto de
-- arvore interna.
-- ------------------------------------------------------------
SELECT
  'I|' || n.nspname || '|' || ic.relname || '|' || tc.relname || '|' ||
  coalesce(pg_get_indexdef(i.indexrelid), '<none>') || '|' ||
  CASE WHEN i.indisunique THEN 'unique' ELSE 'nonunique' END || '|' ||
  CASE WHEN i.indisprimary THEN 'primary' ELSE 'secondary' END || '|' ||
  CASE WHEN i.indisvalid THEN 'valid' ELSE 'invalid' END || '|' ||
  CASE WHEN i.indislive THEN 'live' ELSE 'dead' END || '|' ||
  CASE WHEN i.indpred IS NULL THEN '<none>'
    ELSE pg_get_expr(i.indpred, i.indrelid, true) END || '|' ||
  i.indnatts || '/' || i.indnkeyatts AS token
FROM pg_index i
JOIN pg_class ic ON ic.oid = i.indexrelid
JOIN pg_class tc ON tc.oid = i.indrelid
JOIN pg_namespace n ON n.oid = ic.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY token
;

-- ------------------------------------------------------------
-- [E] C6 - rotinas
-- Correcoes: probin e text (nao bytea). proargdefaults e pg_node_tree (nao
-- array): sai implicitamente por pg_get_function_arguments, que imprime os
-- DEFAULT; nunca por unnest. Nome da funcao e argumento por funcao oficial ou
-- format_type, entao nenhum OID cru entra no token.
-- proargnames pareia com proallargtypes (subscrito 1), enquanto proargtypes e
-- subscrito 0: por isso o pareamento posicional aqui nao e feito a mao.
-- ------------------------------------------------------------
SELECT
  'F|' || n.nspname || '|' || p.proname || '|' ||
  CASE p.prokind
    WHEN 'f' THEN 'function'
    WHEN 'p' THEN 'procedure'
    WHEN 'a' THEN 'aggregate'
    WHEN 'w' THEN 'window'
    ELSE '<unknown>'
  END || '|' ||
  coalesce(pg_get_function_identity_arguments(p.oid), '<none>') || '|' ||
  coalesce(pg_get_function_arguments(p.oid), '<none>') || '|' ||
  CASE WHEN p.proretset THEN 'setof:' ELSE '' END ||
  coalesce(format_type(p.prorettype, NULL), '<none>') || '|' ||
  l.lanname || '|' ||
  CASE WHEN p.proisstrict THEN 'strict' ELSE 'nonstrict' END || '|' ||
  CASE p.provolatile WHEN 'i' THEN 'immutable' WHEN 's' THEN 'stable'
    WHEN 'v' THEN 'volatile' ELSE '<unknown>' END || '|' ||
  CASE p.proparallel WHEN 's' THEN 'safe' WHEN 'r' THEN 'restricted'
    WHEN 'u' THEN 'unsafe' ELSE '<unknown>' END || '|' ||
  CASE WHEN p.prosecdef THEN 'security-definer' ELSE 'invoker' END || '|' ||
  S0(p.probin) || '|' ||
  S0(p.proconfig::text) || '|' ||
  coalesce(pg_get_functiondef(p.oid), '<none>') AS token
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY token
;

-- ------------------------------------------------------------
-- [E] C7 - gatilhos
-- tgoldtable e tgnewtable sao name NULLABLE: gatilho sem tabela de transicao
-- e NULL de verdade, e S0 devolve <none> para isso. Usar coalesce com string
-- vazia apagaria a diferenca entre ausente e vazio.
-- A funcao do gatilho entra por nome, via LATERAL: sem LEFT JOIN pg_proc
-- redundante e sem assinar tgfoid.
-- ------------------------------------------------------------
SELECT
  'T|' || n.nspname || '|' || c.relname || '|' || t.tgname || '|' ||
  coalesce(pg_get_triggerdef(t.oid), '<none>') || '|' ||
  coalesce(fn.proname, '<opaque>') || '|' ||
  coalesce(fn.lanname, '<opaque>') || '|' ||
  CASE WHEN t.tgconstraint = 0 THEN 'standalone' ELSE 'constraint-backed' END || '|' ||
  CASE WHEN t.tgdeferrable THEN 'deferrable' ELSE 'nondeferrable' END || '|' ||
  CASE WHEN t.tginitdeferred THEN 'initdeferred' ELSE 'initimmediate' END || '|' ||
  S0(t.tgoldtable) || '|' ||
  S0(t.tgnewtable) AS token
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN LATERAL (
  SELECT p.proname, l.lanname
  FROM pg_proc p
  JOIN pg_language l ON l.oid = p.prolang
  WHERE p.oid = t.tgfoid
) fn ON TRUE
WHERE NOT t.tgisinternal
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY token
;

-- ------------------------------------------------------------
-- [P] P-CLASS-NATTS - nenhum atributo de relacao some da leitura
-- Invariante: para cada relacao do escopo, o numero de linhas de
-- pg_attribute com attnum > 0 e exatamente pg_class.relnatts (inclui
-- coluna droplada, que sai do token mas nao pode sumir da contagem).
-- Esperado: mismatching_relations = 0.
-- Aborto: mismatching_relations > 0, OU relations_in_scope = 0.
-- Zero objeto em escopo valido NAO e cobertura: e COVERAGE_VOID, e o
-- host para antes de assinar qualquer digest.
-- ------------------------------------------------------------
WITH scoped AS (
  SELECT c.oid, c.relnatts
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'm')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
)
SELECT
  (SELECT count(*) FROM scoped) AS relations_in_scope,
  (SELECT count(*)
     FROM scoped s
    WHERE (SELECT count(*)
             FROM pg_attribute a
            WHERE a.attrelid = s.oid AND a.attnum > 0) <> s.relnatts
  ) AS mismatching_relations
;

-- ------------------------------------------------------------
-- [P] P-SEQ-MAP - toda sequencia do escopo tem linha em pg_sequences
-- Sem essa prova, o C1S poderia assinar <none> em massa por falta de
-- privilegio (pg_sequences so mostra ultima_value de sequencia legivel) e a
-- assinatura sairia parecida entre bancos diferentes.
-- Esperado: sequences_without_view_row = 0. Aborto: > 0.
-- ------------------------------------------------------------
SELECT
  (SELECT count(*)
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  ) AS sequences_in_scope,
  (SELECT count(*)
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_sequences sq
       ON sq.schemaname = n.nspname AND sq.sequencename = c.relname
    WHERE c.relkind = 'S'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND sq.sequencename IS NULL
  ) AS sequences_without_view_row
;

-- ------------------------------------------------------------
-- [P] P-ATTR-PER-SEQ - o filtro do C1S nao corta sequencia de tabela do escopo
-- A sequencia e assinada pelo namespace DELA; se o dono estiver no escopo e a
-- sequencia nao, o token perde uma dependencia real.
-- Esperado: 0. Aborto: > 0.
-- ------------------------------------------------------------
WITH scoped_ns AS (
  SELECT oid
  FROM pg_namespace
  WHERE nspname NOT IN ('pg_catalog', 'information_schema')
)
SELECT count(*) AS owned_sequence_out_of_scope
FROM pg_depend d
JOIN pg_class s ON s.oid = d.objid AND s.relkind = 'S'
JOIN pg_class t ON t.oid = d.refobjid
WHERE d.deptype IN ('a', 'x')
  AND t.relnamespace IN (SELECT oid FROM scoped_ns)
  AND s.relnamespace NOT IN (SELECT oid FROM scoped_ns)
;

-- ------------------------------------------------------------
-- [P] P-VEC - o renderizador de vetor funciona sem unnest()
-- indclass e indcollation sao oidvector; indkey e indoption sao int2vector.
-- Nada aqui imprime conteudo: so prova que HXL devolve valor para todas as
-- linhas. O conteudo bruto dos vetores nao entra em token [E].
-- Esperado: indexes_total = vector_rendered. Aborto: diferente.
-- ------------------------------------------------------------
SELECT
  count(*) AS indexes_total,
  count(HXL(i.indclass)) AS class_rendered,
  count(HXL(i.indcollation)) AS collation_rendered,
  count(HXL(i.indkey)) AS key_rendered
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
;

-- ------------------------------------------------------------
-- [E-diagnostico] Q-INFRA-A - infraestrutura, UMA linha, FORA do digest
-- Nada aqui entra na assinatura: nome de banco, usuario e versao sao contexto
-- de execucao, nao estrutura. As duas correcoes da R6.5 vivem aqui:
--   * database_name por current_database(), nunca pg_database.oid: o OID de
--     banco difere entre clusters e poluiria a comparacao.
--   * to_regclass em vez de consultar a tabela: o ensaio nao pode depender do
--     schema drizzle existir, nem falhar por ele nao existir.
-- ------------------------------------------------------------
SELECT
  current_database()                              AS database_name,
  current_setting('server_version')              AS server_version,
  current_setting('server_version_num')::int     AS server_version_num,
  session_user::text                              AS session_user_name,
  coalesce(current_setting('search_path', true), '<none>') AS raw_search_path,
  coalesce(current_schema(true), '<none>')        AS resolved_schema,
  coalesce(to_regclass('drizzle.__drizzle_migrations')::text, '<absent>') AS ledger_table,
  (SELECT count(*) FROM pg_namespace WHERE nspname NOT IN (
      'pg_catalog', 'information_schema'))     AS user_namespaces,
  (SELECT count(*) FROM pg_extension)              AS extension_count
FROM (VALUES (1)) AS one(x);

-- ------------------------------------------------------------
-- [P] P-LEDGER-STEP-1 - o ledger existe?
-- Esperado: uma linha com ledger_present true ou false.
-- Aborto: zero linhas. false aqui NAO e falha: e o estado legitimo de um banco
-- ainda sem ledger, e muda o roteiro (o passo 2 fica sem rodar).
-- ------------------------------------------------------------
SELECT
  to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS ledger_present
;

-- ------------------------------------------------------------
-- [P] P-LEDGER-STEP-2 - A QUERY LITERAL DO MIGRADOR (drizzle-orm 0.45.2)
-- Copiada de node_modules/drizzle-orm/pg-core/dialect.cjs:
--   select id, hash, created_at from "drizzle"."__drizzle_migrations"
--     order by created_at desc limit 1
-- Sem ORDER BY id, sem NULLS FIRST: quem decide a ordem e o PostgreSQL, que
-- em DESC coloca NULL antes dos valores por omissao. Uma query de ensaio com
-- outra ORDER BY daria conclusao falsa sobre qual migration o migrador acha
-- pendente. Rodar apenas com ledger_present = true.
-- Esperado: zero ou uma linha. Aborto: mais de uma linha.
-- ------------------------------------------------------------
SELECT id, hash, created_at
FROM drizzle.__drizzle_migrations
ORDER BY created_at DESC
LIMIT 1
;

-- ------------------------------------------------------------
-- [P] P-LEDGER-COMPARE - diagnostico do harness, NAO e a query do migrador
-- Regras lidas em node_modules/drizzle-orm/pg-core/dialect.cjs (0.45.2), nao
-- presumidas:
--   1. Number(lastDbMigration.created_at) < folderMillis: comparacao ESTRITA,
--      igualdade nao reexecuta.
--   2. Nao existe guarda por hash: o unico filtro e a timestamp acima. Uma linha
--      com created_at NULL faz Number(null) = 0, e 0 < folderMillis e true para
--      TODAS as entradas do journal - o migrador reexecuta o lote inteiro dentro
--      de uma unica transacao e faz rollback. NULL no ledger nao e benigno.
--   3. O loop inteiro roda dentro de session.transaction: falha no meio do lote
--      nao deixa ledger parcial.
-- Este bloco expoe a contagem; quem decide abortar e o host.
-- Esperado: uma linha, com null_created_at_rows = 0.
-- Aborto: null_created_at_rows > 0. E o estado que faz o migrador reexecutar o
-- journal inteiro dentro de uma transacao, entao o gate para antes de executar.
-- ------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE created_at IS NULL)     AS null_created_at_rows,
  count(*)                                      AS ledger_rows,
  min(created_at)                               AS oldest_applied,
  max(created_at)                               AS newest_applied
FROM drizzle.__drizzle_migrations
;

-- ------------------------------------------------------------
-- [C] FORA DO ESCOPO DESTA REVISAO (sem SQL, portanto nao contam como cobertas)
--   C8                       grants/ACLs finos de objeto
--   C-ENUM                   rotulos e ordem interna de pg_enum
--   C-COLL                   definicao de pg_collation
--   C-TS                     text search config/dict/parser
--   C1V                      dependencia de view (pg_rewrite / ev_quality)
--   pg_statistic_ext_data    estatisticas estendidas
--   pg_amop/pg_amproc/pg_opfamily   operadores de AM customizada
--   associacao fina de publicacao/assinatura
--   membros de extensao
--   pg_description           comentarios de catalogo
--   ACLs globais de database/schema/role
-- Criterio para entrar em revisao futura: bloco [E] completo, com prova [P]
-- de cobertura propria e sem OID cru no token. A assinatura desta revisao e
-- PARCIAL e deve ser apresentada como parcial, nunca como equivalencia integral.
-- ============================================================
-- Fim. Nenhum bloco calcula digest ou sha256 no servidor: a assinatura final
-- e do host, sobre o texto dos tokens [E] ordenados byte a byte.
-- ============================================================
