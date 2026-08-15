# AUDIT — Apostila → Questões (15/08/2026)

## 1. Fluxo atual de geração de questões
- **Fonte de conteúdo:** `QuestionGenerationService.generateFromDocument` (`src/lib/ai/services/question-generation.service.ts`).
  - Puxa **todos os chunks de uma apostila específica** (`DocumentChunkRepository.listByDocument`), junta em um único contexto (até ~12k chars).
  - **Não existe filtro por edital/matéria/aluno no prompt** (a matéria é só o `subjectId` para persistência; não há peso do edital).
- **Acesso:** apenas **admin** — `POST /api/admin/questions/generate` (validado por `AdminGuardService`).
- **Rastreabilidade:** `source_document_id` + `source_chunk_id` (chunk escolhido por sobreposição de termos). Presente.
- **Validação/revisão:** `QuestionValidationService` (score) → persiste `em_revisao` → fila admin `/admin/questoes/revisao`. Presente e reaproveitável.

## 2. Vínculo apostila do aluno ↔ notice_subjects
- **Não existe vínculo direto no fluxo do aluno.**
- `documents` tem colunas `edital_id`/`position_id`, mas **só o admin** as preenche (na rota de upload).
- `document_subjects` (documento↔matéria) **só é preenchido pelo admin** (na rota de upload, bloco `if (admin && ...)`).
- O aluno sobe apostila sem associação automática à matéria/peso do edital dele (`profiles.contest_id`/`position_id`).

## 3. Teste runtime — credenciais (verificado, não assumido)
- Scan de `.env`, `.env.local` (inexistente) e `process.env`: **todas ausentes**.
  - `DEEPSEEK_API_KEY = false`
  - `EMBEDDING_API_URL = false`
  - `R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET = false`
- Consequência (determinística pelo código):
  - `DeepSeekQuestionProvider.isConfigured()` → false → geração responde erro elegante.
  - `embeddingClient.isConfigured()` → false → documento termina em `chunked` (aviso "Embedding não configurado").
  - `isR2Configured()` → false → storage usa **fallback Supabase** (comportamento correto do adapter).
- **BLOQUEIO REAL (ambiente):** as credenciais informadas não existem no ambiente. Não foram criados secrets falsos. As chamadas reais de embedding/geração/R2 não podem ser executadas até as variáveis serem preenchidas (pelo usuário, no `.env`).

## 4. R2 como storage primário
- Adapter pronto (`DocumentStorageService` → `R2StorageService` quando `R2_ACCESS_KEY_ID` presente).
- **Sem credenciais R2, cai no fallback Supabase por design.** Lógica do adapter está correta (não é bug); falta configurar.
- Pendente: teste real de upload no bucket R2 quando as credenciais existirem.

## Conclusão
- Código da pipeline e geração estão completos; o que falta para o runtime real é **configuração de ambiente** (credenciais), não código.
- Implementar (FASE 1): fluxo do aluno (apostila → matéria do edital → gerar questões) + confirmação R2 (FASE 2).
