# CODE REVIEW CHECKLIST

> Checklist reutilizável para revisar qualquer alteração de código.

## PURPOSE

- Garantir qualidade, consistência e aderência aos padrões.
- Detectar problemas antes da integração.
- Servir de guia único para revisão de qualquer módulo.

## PRE-CHECK

- [ ] A alteração tem escopo claro e único.
- [ ] A alteração está relacionada a uma tarefa ou issue.
- [ ] O autor executou testes, lint, typecheck e build.
- [ ] A branch segue o fluxo de git definido.
- [ ] Não há arquivos fora do escopo alterados.

## CHECKLIST

- [ ] Lógica de negócio está na camada correta (service).
- [ ] Persistência está na camada correta (repository).
- [ ] Saídas usam DTO validado.
- [ ] Entradas usam validação (Zod).
- [ ] Autenticação e autorização aplicadas.
- [ ] Sem uso de any.
- [ ] TypeScript strict respeitado.
- [ ] Sem acesso direto a banco pelo frontend.
- [ ] Sem acesso direto a IA pelo frontend.
- [ ] Sem código duplicado.
- [ ] Sem segredos ou dados sensíveis expostos.
- [ ] Tratamento de erros padronizado.
- [ ] Nomes seguem as convenções definidas.
- [ ] Imports limpos, sem não utilizados.
- [ ] Componentes seguem o padrão de server/client.
- [ ] Mensagens de usuário no idioma padrão.

## POST-CHECK

- [ ] Testes relevantes presentes e passando.
- [ ] Lint sem erros.
- [ ] Typecheck sem erros.
- [ ] Build passando.
- [ ] Nenhum problema de segurança identificado.
- [ ] Documentação impactada atualizada.

## ACCEPTANCE

- [ ] Código adere aos padrões do projeto.
- [ ] Nenhum bloqueio de qualidade aberto.
- [ ] Alteração é reversível e de baixo risco.
- [ ] Pronto para integração.
