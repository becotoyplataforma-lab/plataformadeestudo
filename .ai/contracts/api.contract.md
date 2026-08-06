# api.contract.md

> Contrato genérico de uma **API** — ponto de exposição de operações para consumidores externos.

## 1. PURPOSE

- Expor operações de negócio por meio de uma interface de comunicação padronizada.
- Servir como fronteira única entre consumidores e o domínio.
- Garantir contratos estáveis e versionáveis de requisição/resposta.

## 2. RESPONSIBILITIES

- Receber e validar requisições.
- Autenticar e autorizar chamadas.
- Delegar a execução às camadas de regra de negócio.
- Padronizar respostas, erros e metadados.
- Nunca conter lógica de negócio.

## 3. INPUT

- Requisições com estrutura declarada e validável.
- Parâmetros, corpo e cabeçalhos tratados de forma explícita.
- Entradas ausentes ou malformadas são rejeitadas.

## 4. OUTPUT

- Respostas em formato padronizado.
- Corpo de sucesso contendo os dados do contrato.
- Erros com código de status e mensagem compreensível.
- Metadados de paginação, quando aplicável.

## 5. DEPENDENCIES

- Depende das camadas de serviço e/ou repositório.
- Dependências injetadas ou acessadas por contratos.
- Sem dependência direta de infraestrutura no manipulador.

## 6. RULES

- Uma rota mapeia para uma única operação de negócio.
- Autenticação e autorização sempre antes da execução.
- Validação de entrada antes de qualquer efeito colateral.
- Erros nunca vazam para o cliente de forma crua.
- Respostas seguem sempre o mesmo formato de contrato.

## 7. VALIDATIONS

- Validação estrutural de entrada (forma e tipos).
- Validação de autorização (quem pode acessar).
- Validação de regras de negócio delegadas ao serviço.
- Validações de segurança (rate limit, origem) quando aplicável.

## 8. ERROR HANDLING

- Erros de validação: status 4xx com mensagem específica.
- Erros de autorização: status 4xx apropriado.
- Erros internos: status 5xx, sem detalhes internos.
- Erros registrados em log com contexto.
- Falhas não deixam estado parcial.

## 9. ACCEPTANCE CRITERIA

- Requisições válidas retornam resposta padronizada e esperada.
- Requisições inválidas são rejeitadas com feedback claro.
- Acesso não autorizado é bloqueado.
- Erros são consistentes entre todos os endpoints.
- A rota é testável de forma isolada.
- Alterações de domínio não quebram o contrato de API.
