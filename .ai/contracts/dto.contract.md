# dto.contract.md

> Contrato genérico de **DTO** — objeto de transferência de dados nas fronteiras do sistema.

## 1. PURPOSE

- Definir o contrato de dados que cruza as fronteiras do sistema.
- Separar o formato externo (transporte) do modelo interno de domínio.
- Prevenir exposição de dados internos ou sensíveis.

## 2. RESPONSIBILITIES

- Representar, de forma explícita, os dados de entrada e saída das fronteiras.
- Normalizar o formato de dados entre camadas.
- Ocultar campos internos e sensíveis do consumidor.
- Servir de fonte única para validação de dados nas fronteiras.

## 3. INPUT

- Dados de origem variada (domínio, banco, requisição) recebidos como entrada.
- Estrutura de entrada tratada como desconhecida até validação.
- Nenhum campo fora do contrato é aceito implicitamente.

## 4. OUTPUT

- Objeto tipado correspondente ao contrato.
- Apenas campos declarados no contrato são presentes.
- Formato estável e independente de mudanças internas.

## 5. DEPENDENCIES

- Independe de camadas de domínio, banco ou infraestrutura.
- Depende apenas de mecanismo de validação e tipagem.
- Pode depender de mappers para conversão de outras estruturas.

## 6. RULES

- Um DTO representa um contrato único e explícito.
- Não contém lógica de negócio.
- Não expõe campos sensíveis ou internos.
- Campos são tipados e validados.
- Mapeamentos são explícitos e verificáveis.
- Contrato evolui de forma compatível ou versionada.

## 7. VALIDATIONS

- Todo DTO é validado por um schema de validação.
- Campos obrigatórios, tipos e formatos são declarados.
- Dados que não conformam são rejeitados na fronteira.
- Validação ocorre antes de qualquer uso do dado.

## 8. ERROR HANDLING

- Dados inválidos produzem falha controlada e mensagem clara.
- Erros de validação são reportados sem detalhes internos.
- Conversões malsucedidas são tratadas sem efeitos colaterais.

## 9. ACCEPTANCE CRITERIA

- Entrada válida produz DTO tipado conforme o contrato.
- Entrada inválida é rejeitada com feedback claro.
- Nenhum campo fora do contrato é transmitido.
- Nenhum campo sensível é exposto.
- Alterações internas não alteram o contrato externo.
- O DTO é testável isoladamente.
