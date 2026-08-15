# ADMIN — ConcursoAI

Área administrativa em `/admin` (exige allowlist `ADMIN_EMAILS`).

## Rotas
| Rota | Descrição |
|------|-----------|
| `/admin` | Dashboard com contagens reais + alertas |
| `/admin/alunos` | Lista de usuários (email, nível, questões respondidas) |
| `/admin/concursos` | Concursos, editais, cargos e matérias do edital |
| `/admin/apostilas` | Lista + upload/processamento |
| `/admin/apostilas/[id]` | Detalhe + reprocessar + links de geração |
| `/admin/questoes` | Lista/filtros |
| `/admin/questoes/gerar` | Geração por IA |
| `/admin/questoes/revisao` | Fila de revisão (aprovar/rejeitar/bloquear) |
| `/admin/aulas` | Lista + geração de aula |
| `/admin/avatares` | Catálogo + criação de avatar |
| `/admin/ia` | Status IA/embeddings + uso acumulado |

## APIs admin
`/api/admin/*` — todas validam `getAdminSession()` + `AdminGuardService.requireAdmin`.

## Autorização
Admin = allowlist de e-mails (env `ADMIN_EMAILS`, separados por vírgula) + `system_settings`.
Nenhuma coluna `is_admin` é exigida.
