# repository.contract.md

> Contrato genérico de **Repository** — camada de acesso e persistência de dados.

## 1. PURPOSE

- Encapsular o acesso a dados persistentes para o domínio.
- Isolar consultas e escrita de banco das demais camadas.
- Prover uma interface estável de dados independente do banco subjacente.

## 2. RESPONSIBILITIES

- Executar operações de leitura e escrita de dados.
- Mapear resultados do banco para estruturas de domínio.
- Encapsular consultas específicas e filtros.
- Garantir que os dados retornados respeitem os contratos definidos.
- Não conter regras de negócio.

## 3. INPUT

- Identificadores, filtros e dados de escrita tipados.
- Parâmetros de consulta explícitos.
- Entradas já validadas pela camada de serviço.

## 4. OUTPUT

- Resultados de leitura tipados (entidades/estruturas de domínio).
- Resultados de escrita com confirmação de sucesso ou falha.
- Nunca expõe detalhes internos do banco ao chamador.

## 5. DEPENDENCIES

- Depende exclusivamente da camada de banco de dados.
- Acessado apenas por services.
- Sem dependência de UI, transporte ou apresentação.

## 6. RULES

- Um repositório agrupa operações de uma mesma entidade/agregado.
- Não contém lógica de negócio ou validação de regras de domínio.
- Consultas são parametrizadas e seguras.
- Opera dentro do controle de acesso de dados aplicado.
- Nome e comportamento das operações espelham o domínio.

## 7. VALIDATIONS

- Valida a forma dos dados de escrita antes da persistência.
- Respeita constraints e políticas de acesso do banco.
- Trata ausência de registros de forma explícita.

## 8. ERROR HANDLING

- Traduz erros de banco em resultados compreensíveis.
- Registra falhas em log sem expor dados sensíveis.
- Indica claramente quando um registro não foi encontrado.
- Não propaga exceções internas do banco à camada superior.

## 9. ACCEPTANCE CRITERIA

- Leitura e escrita funcionam conforme o contrato de dados.
- Resultados são tipados e aderentes ao domínio.
- Consultas são seguras (sem interpolação insegura).
- Registro ausente é tratado sem erro de infraestrutura.
- O repositório é substituível por outro banco sem alterar o chamador.
- O repositório é testável isoladamente.
