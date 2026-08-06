# ARCHITECTURE

## PURPOSE
- Definir a arquitetura oficial do sistema.

## CONTEXT
- Padrão: modular monolith.
- Não há microsserviços no MVP.
- Módulos são independentes internamente.
- A separação lógica permite migração futura para microsserviços.

## DECISIONS
- Camadas: fronteira, service, repository, dados.
- Server Components por padrão.
- RLS é a fonte da verdade de permissões.
- Toda saída de fronteira passa por DTO.

## RULES
- Fluxo entre módulos: fronteira chama service; service chama repository; saída passa por DTO.
- Nunca acessar banco pelo React.
- Nunca acessar IA pelo frontend.
- Nunca colocar lógica de negócio em componentes.
- Nova funcionalidade usa DTO, Zod, Repository, Service, Mapper.

## OUT OF SCOPE
- Migração para microsserviços no MVP.

## REFERENCES
- .ai/02-ARCHITECTURE.md
- .ai/DTO-GUIDELINES.md
- docs/02-SDD.md
