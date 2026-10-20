# knowledge-apostilas — Apostilas (Minhas Apostilas / Fase 1)

> Spec de funcionalidade. Template: `.ai/templates/spec.template.md`.
> Decisão de arquitetura: ADR-011 (`.ai/16-ADR.md` e `.ai/adr/ADR-011-STORAGE-ADAPTER-PROXY.md`).

## PURPOSE
- Entregar a UI "Minhas Apostilas" sobre o **Knowledge Core já existente**, sem novas tabelas:
  listar os materiais de estudo do usuário organizados por **Concurso → Matéria → Apostila** e
  permitir **ler** e **baixar** o PDF dentro da plataforma.
- Introduzir a camada de armazenamento (`StorageAdapter`) que hoje falta: a ingestion grava
  `documents.storage_path`, mas não existia nenhum código para **recuperar** os bytes.

## SCOPE
**In scope (Fase 1)**
- `GET /api/apostilas` — lista filtrada e agrupada, saída por DTO (`ApostilasListaDto`).
- `GET /api/apostilas/[id]/arquivo` — proxy autenticado dos bytes (200 / 206 / 416).
- `src/lib/storage/` — contrato `StorageAdapter` + `LocalStorageAdapter` (dev) +
  `R2StorageAdapter` (produção) + fábrica por `STORAGE_DRIVER`.
- Página `(dashboard)/apostilas` (SSR) + `apostilas-client.tsx` (filtros, agrupamento, leitor
  em `Dialog`) + item na sidebar.
- Filtros: matéria (join), concurso/trilha (JSONB `metadata`) e busca por título (`ILIKE`).

**Out of scope (outras fases)**
- UI de upload (a rota `POST /api/knowledge/upload` existente continua sendo a entrada).
- Marcar `doc_type = "apostila"` automaticamente, OCR, classificação por IA, busca semântica
  restrita às apostilas, anotações/highlights, link público de partilha, exclusão pela UI.

## DEPENDENCIES
- Banco (sem migração): `documents`, `document_subjects`, `knowledge_subjects`
  (`src/db/schema/knowledge.ts`) via `@/lib/db/drizzle`.
- Auth: `auth()` de `@/lib/auth/auth` (NextAuth v5, JWT com `user.id`).
- Contratos: `@/lib/dto` (`parseDto`/`strictDto`) e Zod.
- Instaladas nesta fase: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
- Variáveis (`src/lib/env.ts`): `STORAGE_DRIVER` (default `local`), `STORAGE_LOCAL_DIR`
  (default `.storage/apostilas`), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET_NAME` (default `concursoai-documents`), `R2_PUBLIC_URL` (opcional).
- `.gitignore`: `/.storage/` — arquivos de usuários nunca entram no repositório.

## INPUT
- `GET /api/apostilas?materia_id=<uuid>&concurso=<texto>&busca=<texto>`
  (`apostilasFilterSchema`; parâmetro vazio = ausente).
- `GET /api/apostilas/[id]/arquivo` com `id` UUID (`apostilaIdParamSchema`) e header
  `Range: bytes=start-end` opcional.

## OUTPUT
- Lista (`ApostilasListaDto`), com `materias[]` e `apostilas[]`:

```json
{
  "usuario_id": "uuid",
  "total_apostilas": 1,
  "total_materias": 2,
  "concursos": ["CBM-RJ 2026"],
  "materias": [
    {
      "materia_id": "uuid | \"sem-materia\"",
      "materia_nome": "Física",
      "materia_cor": "#22d3ee",
      "total": 1,
      "apostilas": [
        {
          "id": "uuid", "titulo": "…", "tipo": "pdf", "status": "indexed",
          "tamanho_bytes": 12345, "mime_type": "application/pdf",
          "concurso": "CBM-RJ 2026", "materia_id": "uuid", "materia_nome": "Física",
          "materia_cor": "#22d3ee",
          "arquivo_url": "/api/apostilas/<uuid>/arquivo",
          "criado_em": "2026-01-10T12:00:00.000Z"
        }
      ]
    }
  ]
}
```

- **`storage_path` não existe no DTO** — o cliente só conhece `arquivo_url`.
- Arquivo: stream com `Content-Type`, `Content-Length`, `Content-Disposition: inline`,
  `Accept-Ranges: bytes`, `Cache-Control: private`, `ETag`/`Last-Modified` quando houver;
  `206` + `Content-Range` em leitura parcial; `416` quando o Range não cabe no arquivo.
- Erros: `401` sem sessão · `400` UUID/param inválido · `404` inexistente ou de outro usuário ·
  `501` driver sem suporte a URL · `500`/`502` storage/config.

## IMPLEMENTATION
1. `src/lib/storage/types.ts` — contrato `StorageAdapter` (`upload`, `getStream`, `getUrl`,
   `delete`, `exists`), `StorageError` com códigos estáveis e `assertSafeKey`.
2. `src/lib/storage/local.adapter.ts` — raiz `STORAGE_LOCAL_DIR`; leitura em blocos de 64 KB
   com Range; `resolvePath` confina o alvo dentro da raiz; `getUrl` **recusa** devolver caminho
   de disco (`NOT_SUPPORTED`).
3. `src/lib/storage/r2.adapter.ts` — `S3Client` (`region: "auto"`, endpoint
   `https://<account>.r2.cloudflarestorage.com`), `Put/Get/Head/DeleteObjectCommand`, URL
   pré-assinada de 300 s (ou `R2_PUBLIC_URL`), normalização de stream Node/Web.
4. `src/lib/storage/index.ts` — fábrica + singleton `getStorage()` e `setStorageForTests()`;
   **sem fallback silencioso**: `STORAGE_DRIVER=r2` sem credencial falha com `CONFIG_MISSING`.
5. `src/lib/validations/apostilas.ts` — filtros, param de rota e `parseByteRange`
   (`full` | `range` | `unsatisfiable`, incluindo suffix range `bytes=-N`).
6. `src/lib/dto/apostilas.dto.ts` — `apostilaRowSchema` (defensivo), `ApostilaDtoSchema`,
   `MateriaApostilasDtoSchema`, `ApostilasListaDtoSchema`, `toApostilaDto(List)`,
   `toApostilasListaDtoStrict`, `apostilaArquivoUrl`.
7. `src/lib/knowledge/repositories/apostilas.repository.ts` — `listByUser` (LEFT JOIN
   `document_subjects`→`knowledge_subjects`, `deleted_at IS NULL`, tipos `pdf|apostila`,
   `ILIKE` escapado) e `findOwnedById` (filtro por `user_id`); exportados no barrel.
8. `src/lib/knowledge/services/apostilas.service.ts` — `listar` e `abrirArquivo` + funções
   puras `agruparPorMateria`, `extrairConcursos`, `nomeArquivoDownload`; exportados no barrel.
9. `src/app/api/apostilas/route.ts` e `src/app/api/apostilas/[id]/arquivo/route.ts` — padrão
   real do projeto (`auth()` + `apiError`/`apiOk` de `@/lib/api/helpers`; `params` é `Promise`).
10. UI: `src/app/(dashboard)/apostilas/page.tsx` (SSR best-effort, `redirect("/login")`) →
    `src/components/apostilas/apostilas-client.tsx` → `apostila-leitor.tsx` (Blob URL +
    `<object>`; `react-pdf` não é dependência do projeto).

**Fase 2 — persistência de bytes e ingestão de apostila real**

11. `src/lib/knowledge/services/ingestion.service.ts` — grava os bytes reais antes do registro:
    `await getStorage().upload(storagePath, buffer, file.type)`. Falha de storage →
    `IngestionError("UPLOAD_FAILED")` (a rota devolve 500) e **nada** é inserido no banco; falha no
    `create` ou no vínculo de matéria → rollback com `getStorage().delete(storagePath)` (sem órfãos).
    `IngestionInput` ganhou `title`, `metadata` e `subjectId` opcionais (a rota de upload não passa
    e mantém o comportamento anterior).
12. `src/lib/knowledge/services/document.service.ts` + `src/app/api/knowledge/documents/[id]/route.ts`
    (`DELETE`) — não existia nenhum caminho de deleção (só `DocumentRepository.softDelete`, órfão).
    Agora: posse → `softDelete` → limpar `document_subjects|topics|tags` + chunks →
    `getStorage().delete(storagePath)`. Resultado `{ status, bytesRemovidos }` sem `storagePath`.
13. `src/lib/storage/index.ts` — `resolveLocalStorageRoot()` exported (fonte única da raiz local,
    usada pelo app e pela CLI) com `/* turbopackIgnore: true */` para o build não rastrear o projeto.
14. `scripts/ingest-local-apostila.ts` + `npm run apostila:ingest` / `npm run apostila:sync`
    (`tsx` em `devDependencies`) — CLI de dev: com `DATABASE_URL` usa o `IngestionService` real
    (bytes + linha + vínculo); sem banco grava os bytes no `StorageAdapter` e escreve o manifesto
    `.storage/pending-ingest.json` com os valores necessários para inserir a linha, e o
    `apostila:sync` (`--do-manifesto`) completa essa linha quando o `.env.local` chegar — confere
    tamanho e SHA-256 dos bytes antes de inserir e aceita `--usuario` para o dono real.
    Idempotente por `--doc-id`.
15. `src/app/api/apostilas/__tests__/api-apostilas-arquivo.test.ts` — homologação do PDF real:
    exerce o handler `GET` com `getStorage()` **de verdade** (driver local) e os bytes ingeridos pela
    CLI; fica `skip` em clone limpo/CI (não falha por falta de `.env.local`).

## RULES
- **Posse:** toda consulta filtra por `documents.user_id = session.user.id`; o `id` recebido do
  cliente nunca autoriza leitura sozinho (`.ai/08`).
- **Nunca expor `storage_path`:** saiu por DTO; o acesso aos bytes é só pela rota `/arquivo`.
- **`assertSafeKey`:** rejeita `..`, `.` , caminho absoluto, `\`, `:` e caracteres de controle —
  uma linha adulterada na tabela não permite ler fora da raiz.
- **Tipos considerados "apostila":** `pdf` **e** `apostila`. Motivo: a ingestion atual mapeia
  PDF para `doc_type = "pdf"` e nunca grava `"apostila"` (`ingestion.service.ts`, mapa de MIME).
- **Concurso/trilha:** vem de `documents.metadata` (`concurso` → fallback `trilha`), porque não
  existe FK de concurso em `documents`; o filtro é comparado case-insensitive.
- **N:M:** uma apostila pode pertencer a várias matérias → sai em mais de um grupo, mas
  `total_apostilas` conta **ids distintos** (nunca linhas do join).
- **Ordem:** matérias em `localeCompare("pt-BR")`; o grupo `sem-materia` vai por último.
- **Busca:** `ILIKE` com `%`, `_` e `\` escapados (busca literal).
- **Storage:** driver escolhido por env, sem fallback; `Cache-Control: private` (resposta
  dependente de sessão); Range é validado contra `documents.file_size` antes de abrir o stream.
- **Fase 2 — ordem da escrita:** primeiro os bytes, depois a linha. Assim uma falha de storage
  nunca cria um documento "listável mas sem arquivo" (o 404 do `/arquivo` que existia na Fase 1).
- **Fase 2 — deleção é destrutiva:** o soft delete **apaga os bytes**; não há feature de restauro,
  então a recuperação do arquivo exige re-ingestão (decisão da diretriz de engenharia).
- **Fase 2 — posse na deleção:** `DocumentService.remover` recebe `userId` e compara com a linha;
  documento de outro usuário devolve `nao_encontrado` e nenhum byte é tocado.
- **Fase 2 — CLI:** `npx tsx` puro **falha** ao importar `@/lib/storage` (guard `server-only`);
  é obrigatório `--conditions=react-server` (o script npm já passa). No Windows, chamar por
  `npm run` transcodifica acentos pelo `cmd.exe` — para argumentos com acentos invoque
  `node --conditions=react-server --import tsx scripts/ingest-local-apostila.ts ...`.

## TESTES
Suite completa: `npm test` → **461 casos a passar, 0 a falhar** (10 ficheiros de integração em
`skip` por falta de `DATABASE_URL`). `npx vitest run src/lib/storage src/lib/knowledge
src/app/api/apostilas` → 52 casos / 8 ficheiros; `npx vitest run scripts` → 13 casos / 1 ficheiro.
- Fase 1 — `local.adapter.test.ts`: upload dentro da raiz, leitura inteira, Range fechado e aberto,
  `NOT_FOUND`, rejeição de 7 chaves perigosas, `getUrl` sem vazamento, `delete` idempotente.
- Fase 1 — `apostilas.service.test.ts`: agrupamento N:M com contagem distinta, **payload sem
  `storage_path`**, filtro de concurso case-insensitive, grupo "Sem matéria" por último,
  abertura com Range + `fileName` sanitizado, `range_nao_satisfeita`, posse (devolve `null` e
  não toca o storage) e as funções puras.
- Fase 2 — `ingestion.service.test.ts` (12): os bytes são gravados num `LocalStorageAdapter` real
  de diretório temporário (nada escreve em `.storage/`), título/metadata explícitos, vínculo de
  matéria, `UPLOAD_FAILED` sem chegar ao `create`, rollback dos bytes quando falha o `create` e
  quando falha a junção.
- Fase 2 — `document.service.test.ts` (4): apaga linha + vínculos + chunks + bytes; posse (não
  apaga arquivo alheio); linha inexistente; `bytesRemovidos: false` quando o storage está em baixo.
- Fase 2 — `api-apostilas-arquivo.test.ts` (3): **homologação com o PDF real** (4.968.035 bytes)
  exercendo o handler `GET` com o `getStorage()` verdadeiro (driver local): 200 com SHA-256 igual ao
  do manifesto, 206 para `bytes=0-3` (`Content-Range: bytes 0-3/4968035`), 404 para sessão não-dona.
  Fica `skip` quando o artefato de dev não existe (CI/clone limpo).
- Fase 2 — `scripts/__tests__/ingest-manifesto-sync.test.ts` (13): o `apostila:sync` insere a linha
  apontando para os bytes **já** no storage (LocalStorageAdapter real em diretório temporário,
  repositórios mockados), recusa inserir quando tamanho ou SHA-256 divergem, mantém o registro
  quando os bytes faltam, é idempotente (linha existente / mesmo hash), re-indexa a chave quando
  `--usuario` muda o dono (só apaga a origem depois do insert) e faz rollback quando o `create`
  ou o vínculo de matéria falham.

## CHECKLIST
- [x] Nenhuma migração/tabela nova; hierarquia montada com as tabelas existentes.
- [x] DTO + validação Zod nas duas rotas; entrada validada em `src/lib/validations`.
- [x] `npm run typecheck` limpo · `eslint` sem erros/warnings nos ficheiros novos/alterados ·
      `npm run build` sem avisos novos (o `resolveLocalStorageRoot` leva `turbopackIgnore` para o
      build não rastrear o projeto inteiro) · 461 testes a passar.
- [x] `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner` em `dependencies`.
- [x] `.gitignore` com `/.storage/` **antes** de qualquer arquivo de usuário ser gravado.
- [x] Sidebar com entrada "Apostilas" (`/apostilas`).
- [x] **Fase 2 — bytes:** a ingestão grava o conteúdo real no `StorageAdapter` e a deleção remove-o
      (com rollback quando o banco falha); `metadata.concurso` e o vínculo de matéria já são
      suportados pelo service (`title`/`metadata`/`subjectId`).
- [x] **Fase 2 — apostila real ingerida:** CBM-RJ / Português / "Aula 01 - Completo",
      4.968.035 bytes, SHA-256 `1fffa65c930a73fd…f08375ae`, em
      `.storage/apostilas/00000000-…-000000000001/8fa777bb-…/curso-384118-aula-01-f2d1-completo.pdf`
      (pasta ignorada pelo `.gitignore` — nada de usuário entra no repositório).
- [x] **Fase 2 — `/api/apostilas/[id]/arquivo` sem 404:** validado ao nível do handler com o PDF
      real (200 completo + 206 com Range + 404 para não-dono), ver
      `src/app/api/apostilas/__tests__/api-apostilas-arquivo.test.ts`.
- [ ] **Linha em `documents`:** falta o `.env.local` com `DATABASE_URL`. A CLI já deixou os bytes e o
      manifesto `.storage/pending-ingest.json`; ao configurar o banco, rodar
      `npm run apostila:sync -- --usuario <uuid real>` (re-indexa a chave para o dono e insere a
      linha) — então `/apostilas` lista a apostila de verdade.
- [ ] **E2E/Playwright com sessão real:** bloqueado pelo mesmo `.env.local` (auth + banco).
      Nota: a rota já foi exercida em teste automatizado com bytes reais, sem navegador.
- [ ] **Problemas pré-existentes reportados, não corrigidos por diretiva**: colisão de rota em
      `/` (`src/app/page.tsx` vs `src/app/(dashboard)/page.tsx`), `drizzle/` ignorado no
      `.gitignore` (migrations não versionadas) e `drizzle-orm` em `devDependencies`.
- [ ] Upload pela UI com escolha de matéria/concurso e `doc_type = "apostila"` (Fase 3 — o service
      já aceita `title`/`metadata`/`subjectId`, mas a rota `/api/knowledge/upload` ainda não os expõe).
