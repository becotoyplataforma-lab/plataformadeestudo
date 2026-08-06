# RELEASE CHECKLIST

> Checklist reutilizável para preparar e publicar uma release.

## PURPOSE

- Garantir que toda release seja segura, testada e documentada.
- Reduzir risco de falhas em produção.
- Servir de guia único para qualquer release do sistema.

## PRE-CHECK

- [ ] Todas as tarefas da release concluídas.
- [ ] Todos os itens de definição de pronto cumpridos.
- [ ] Nenhum bloqueio ou bug crítico em aberto.
- [ ] Alterações revisadas e aprovadas.
- [ ] Documentação da release atualizada.

## CHECKLIST

- [ ] Migrations de banco criadas e revisadas.
- [ ] Migrations testadas em ambiente de staging.
- [ ] Variáveis de ambiente adicionadas ou atualizadas.
- [ ] Backups do banco confirmados.
- [ ] Testes executados no ambiente de staging.
- [ ] Lint, typecheck e build executados.
- [ ] Verificações de segurança realizadas.
- [ ] Nenhum segredo exposto em código ou logs.
- [ ] Performance validada nos fluxos críticos.
- [ ] Changelog atualizado.

## POST-CHECK

- [ ] Deploy realizado no ambiente de produção.
- [ ] Migrations aplicadas em produção com sucesso.
- [ ] Health check passando.
- [ ] Monitoramento ativo (erros e métricas).
- [ ] Fluxos críticos validados em produção.
- [ ] Rollback testado ou pronto para execução.
- [ ] Alertas configurados para falhas.

## ACCEPTANCE

- [ ] Release publicada sem incidentes conhecidos.
- [ ] Sistema disponível e operacional.
- [ ] Documentação alinhada ao que foi publicado.
- [ ] Plano de rollback documentado.
