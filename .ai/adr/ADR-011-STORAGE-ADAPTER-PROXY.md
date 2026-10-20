# ADR-011 - StorageAdapter com proxy autenticado para arquivos

## Status
Accepted (refina o ADR-003 — Cloudflare R2 para documentos).
Fase 1: leitura via proxy autenticado · Fase 2: escrita/exclusão de bytes e CLI de ingestão.

## Context
- O Knowledge Core persiste `documents.storage_path` na ingestion, mas **nenhum código lia os
  bytes de volta**: não existia camada de storage no repositório.
- O R2 ainda não está configurado (`.env.example` traz `R2_*` vazios e `@aws-sdk/client-s3`
  não estava em `dependencies`), enquanto o desenvolvimento local precisa funcionar já.
- Expor `storage_path` (caminho do bucket ou do disco) ao cliente criaria acesso direto a
  arquivos de outros usuários, violando `.ai/08-SECURITY-STANDARDS.md`.
- Leitores de PDF embutidos em navegador emitem `Range` parciais; uma resposta apenas "inteira"
  degrada a experiência em arquivos grandes.

## Decision
- Criar a interface `StorageAdapter` em `src/lib/storage/types.ts`
  (`upload`, `getStream`, `getUrl`, `delete`, `exists`) com `StorageError` de códigos estáveis.
- Duas implementações: `LocalStorageAdapter` (dev, raiz `STORAGE_LOCAL_DIR`, hoje
  `.storage/apostilas`) e `R2StorageAdapter` (produção, `@aws-sdk/client-s3`, endpoint
  `<account>.r2.cloudflarestorage.com`, `region: "auto"`).
- Fábrica por `STORAGE_DRIVER` com singleton (`getStorage()`); **sem fallback silencioso** de
  driver — credenciais ausentes com `r2` falham com `CONFIG_MISSING`.
- A leitura pelo cliente passa exclusivamente pela rota autenticada
  `GET /api/apostilas/[id]/arquivo`, que valida a posse em `documents.user_id` e transmite o
  stream (200/206/416). `getUrl()` com presigned URL existe para casos de download direto no
  futuro, mas não é o caminho padrão da Fase 1.
- `assertSafeKey` rejeita `..`, `.`, caminho absoluto, `\`, `:` e caracteres de controle; o
  adaptador local ainda confirma que o alvo resolvido permanece dentro da raiz.

## Consequences
- Dev/testes rodam sem nuvem; `pnpm`/`npm` ganha duas dependências AWS SDK.
- Trocar de provedor de armazenamento afeta apenas `src/lib/storage/`.
- Toda leitura de arquivo custa um request autenticado ao app (sem CDN) — aceitável na Fase 1;
  presigned URLs ou cache ficam para a Fase 2.
- `/.storage/` precisa estar fora do git (adicionado antes de qualquer gravação).
- HTTP Range precisa ser tratado no serviço (validado contra `documents.file_size`).

## Benefits
- Nenhum identificador de arquivo sensível cruza a fronteira API → cliente.
- Contrato testável com mock (17 casos sem banco nem disco).
- Pronto para R2 em produção mudando uma variável de ambiente.
- Proteção contra linha adulterada na tabela `documents` (path traversal).

## Alternatives Considered
- **Ler direto do bucket com URL pública no DTO** (rejeitada — quebraria a posse por usuário e
  tornaria `storage_path` em segredo de fronteira).
- **Presigned URL por request como caminho padrão** (rejeitada na Fase 1 — exige bucket
  configurado para desenvolver, e o cache privado do app resolve o caso de uso).
- **Gravação dos PDFs no Supabase Storage** (rejeitada — o ADR-003 já elegeu R2 para documentos
  pesados por custo de egress, e o código atual de ingestion usa `storage_path` livre).
- **Usar `react-pdf` para renderizar página a página** (rejeitada — nova dependência; o
  visualizador nativo do navegador via Blob URL cobre a Fase 1).

## Atualização — Fase 2 (persistência de bytes)
- A ingestion passou a gravar o conteúdo real: `await getStorage().upload(storagePath, buffer,
  file.type)` **antes** do `DocumentRepository.create`. Ordem escolhida de propósito: se o storage
  falhar não existe linha "listável sem arquivo" (o 404 que a Fase 1 deixava acontecer); se o banco
  ou o vínculo de matéria falharem, os bytes recém-gravados são removidos (`delete`) — sem órfãos.
- A exclusão de documento (`DocumentService.remover`, `DELETE /api/knowledge/documents/[id]`)
  agora remove também o objeto no storage. **Consequência assumida:** o soft delete deixa de ser
  recuperável; re-ingerir é a única forma de restaurar o arquivo.
- O resultado da exclusão traz `bytesRemovidos: boolean` em vez de propagar a falha: o usuário já
  não vê o documento, e a limpeza pendente fica sinalizada no log/DTO sem expor `storage_path`.
- Tooling de servidor: módulos protegidos por `server-only` (incluindo `@/lib/storage`) não abrem
  em `npx tsx` puro. A CLI corre com `tsx --conditions=react-server` — o guard continua ativo no
  bundle do app, apenas o script de dev declara a condição de servidor.
- `resolveLocalStorageRoot()` (exportada em `src/lib/storage/index.ts`) é a fonte única da raiz
  local para app e CLI; leva `/* turbopackIgnore: true */` porque, sem isso, o `next build`
  (Turbopack) passou a rastrear o projeto inteiro por causa do `path.resolve(process.cwd(), …)`.
- A CLI fecha o ciclo em dois passos: `apostila:ingest` grava os bytes (e, sem banco, deixa o
  manifesto `.storage/pending-ingest.json`); `apostila:sync` lê esse manifesto e insere a linha —
  apenas depois de conferir tamanho e SHA-256 do objeto, movendo a chave só quando `--usuario` muda
  o dono e apagando a origem depois do insert. Um registro que falhe em qualquer verificação
  continua no manifesto: o comando nunca deixa linha sem bytes nem bytes sem linha.
