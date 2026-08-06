# IMPLEMENTATION CHECKLIST

> Checklist reutilizável para implementar qualquer funcionalidade ou módulo.

## PURPOSE

- Garantir que toda implementação siga o mesmo processo, da especificação à entrega.
- Reduzir retrabalho e inconsistências.
- Servir de guia único para qualquer módulo do sistema.

## PRE-CHECK

- [ ] Ler a documentação relevante da pasta .ai.
- [ ] Ler a documentação relevante da pasta docs.
- [ ] Ler/ criar a spec da funcionalidade na pasta specs.
- [ ] Identificar o domínio e o módulo afetados.
- [ ] Verificar se existe código, contrato ou template relacionado.
- [ ] Validar a arquitetura e os padrões obrigatórios aplicáveis.
- [ ] Confirmar que não há conflito com implementações em andamento.

## CHECKLIST

- [ ] Definir tipos e contratos de dados.
- [ ] Definir validação de entrada.
- [ ] Definir DTO de saída.
- [ ] Implementar a camada de dados (repository).
- [ ] Implementar a camada de regra de negócio (service).
- [ ] Implementar a fronteira (api ou action).
- [ ] Implementar a interface de usuário.
- [ ] Aplicar autenticação e autorização.
- [ ] Aplicar validação em todas as fronteiras.
- [ ] Garantir tratamento de erros padronizado.
- [ ] Documentar a API e as mudanças.
- [ ] Atualizar documentação afetada.

## POST-CHECK

- [ ] Executar testes.
- [ ] Executar lint.
- [ ] Executar typecheck.
- [ ] Executar build.
- [ ] Corrigir todos os erros encontrados.
- [ ] Reexecutar as verificações após correções.
- [ ] Revisar o código final.

## ACCEPTANCE

- [ ] Atende aos critérios de aceite da spec.
- [ ] Segue os padrões obrigatórios de arquitetura.
- [ ] Não introduz regressões.
- [ ] Nenhum dado sensível é exposto.
- [ ] Mensagens e interface estão no idioma padrão do produto.
- [ ] A documentação está atualizada.
- [ ] A definição de pronto foi cumprida.
