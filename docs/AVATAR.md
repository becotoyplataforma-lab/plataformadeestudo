# AVATAR — ConcursoAI

Professor virtual com personalidade de desenho animado.

## Personagem original
O ConcursoAI usa **personagens originais** (não copia Taz nem qualquer personagem protegido).

Seed padrão: **Prof. Rafa** — energético, didático, usa mnemônicos, aparência própria
(cabelo laranja, óculos redondos, camisa xadrez, moletom azul), voz pt-BR.

## Modelo (`avatars`)
`nome`, `slug`, `descricao`, `personalidade`, `aparencia`, `voz`, `ativo`.

## Estrutura para o futuro (vídeo)
- `avatar_id` em `lessons` permite vincular a aula a um avatar.
- Primeira versão: avatar + roteiro + player preparado (sem vídeo externo obrigatório).
- Futuro: voz (TTS), lip sync, renderização — conectáveis sem mudar o domínio.

## Admin
`/admin/avatares` — listar e criar. API `POST /api/admin/avatares`.
