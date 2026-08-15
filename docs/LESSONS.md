# LESSONS — ConcursoAI

Aulas geradas a partir de apostilas (FASE 17).

## Estrutura de uma aula
`lessons` (título, matéria, documento, capítulo, avatar, roteiro JSONB, duração, status) +
`lesson_progress` (progresso do aluno por aula).

## Roteiro (`LessonGenerationService`)
Seções obrigatórias: `introducao`, `objetivos`, `explicacao`, `exemplo`,
`ponto_importante`, `revisao`, `questao`, `encerramento`.

## APIs
- `GET /api/lessons` — aulas visíveis ao aluno (globais ou dele).
- `GET /api/lessons/[id]` — detalhe + progresso.
- `POST /api/lessons/[id]/progress` — atualiza progresso.
- `POST /api/admin/lessons/generate` — gera aula (admin).

## Telas
- `/aulas` — lista; `/aulas/[id]` — player com seções e barra de progresso.
- `/admin/aulas` — lista + geração.
