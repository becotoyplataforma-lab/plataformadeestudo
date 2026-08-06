# service.contract.md

> Contrato genérico de **Service** — camada de regras de negócio e orquestração.

## 1. PURPOSE

- Concentrar e aplicar as regras de negócio do domínio.
- Orquestrar a colaboração entre camadas (repositório, integrações, dados).
- Manter componentes e fronteiras livres de lógica de negócio.

## 2. RESPONSIBILITIES

- Aplicar regras de negócio de forma consistente.
- Coordenar fluxos que envolvem múltiplas fontes de dados.
- Garantir invariantes do domínio antes e depois de operações.
- Expor operações de negócio claras e tipadas.
- Não lidar com transporte de rede nem apresentação.

## 3. INPUT

- Entradas declaradas e tipadas, já validadas na fronteira.
- Dependências recebidas por injeção ou acesso por contrato.
- Parâmetros de domínio explícitos.

## 4. OUTPUT

- Resultados de negócio tipados.
- Saídas em formato de contrato (ex.: DTO), nunca entidades cruas.
- Retornos padronizados de sucesso e falha.

## 5. DEPENDENCIES

- Depende de repositórios e adaptadores de integração.
- Dependências acessadas via contratos, permitindo substituição.
- Independente de framework de apresentação ou transporte.

## 6. RULES

- Um service reúne regras de um mesmo domínio.
- Não acessa banco diretamente — usa repositório.
- Não expõe detalhes de persistência ou infraestrutura.
- Não mantém estado compartilhado entre requisições.
- Idempotência quando a operação for reexecutável.

## 7. VALIDATIONS

- Revalida regras de negócio além da validação estrutural de entrada.
- Valida pré-condições e pós-condições das operações.
- Validações falhas não produzem efeitos colaterais.

## 8. ERROR HANDLING

- Trata erros de domínio e traduz em resultados compreensíveis.
- Propaga falhas de infraestrutura de forma controlada.
- Registra logs de negócio com contexto.
- Não vaza exceções internas para a fronteira.

## 9. ACCEPTANCE CRITERIA

- Regras de negócio são aplicadas consistentemente.
- Operações retornam resultados tipados e padronizados.
- Dependências são substituíveis sem alterar o contrato.
- Componentes e fronteiras não contêm lógica de negócio.
- Pré-condições violadas são rejeitadas sem efeitos colaterais.
- O service é testável isoladamente.
