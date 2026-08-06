# database.contract.md

> Contrato genérico de **Banco de Dados** — camada de armazenamento e acesso a dados persistentes.

## 1. PURPOSE

- Prover persistência confiável e segura dos dados da aplicação.
- Separar o modelo físico de dados das camadas de domínio.
- Garantir integridade, consistência e segurança no nível de armazenamento.

## 2. RESPONSIBILITIES

- Armazenar e recuperar dados conforme contratos definidos.
- Garantir integridade referencial e consistência transacional.
- Aplicar controle de acesso em nível de dados.
- Oferecer índices adequados ao padrão de consulta.
- Prover versionamento de estrutura (migrations).

## 3. INPUT

- Operações de escrita com dados validados pelas camadas superiores.
- Consultas parametrizadas, sem interpolação insegura.
- Identificadores e filtros tipados.

## 4. OUTPUT

- Resultados de leitura aderentes aos contratos de dados.
- Resultados de escrita com confirmação de sucesso ou falha.
- Nenhum dado sensível é retornado fora dos contratos autorizados.

## 5. DEPENDENCIES

- Depende exclusivamente do sistema de banco de dados subjacente.
- Acessado somente pela camada de repositório.
- Sem dependência de UI ou lógica de apresentação.

## 6. RULES

- Acesso a dados apenas por camadas autorizadas.
- Controle de acesso aplicado no nível do banco (linhas e colunas).
- Migrations são versionadas e não destrutivas quando possível.
- Operações atômicas não deixam estado parcial.
- Consultas são eficientes e indexadas conforme necessidade.

## 7. VALIDATIONS

- Estrutura de dados validada antes da persistência.
- Constraints (unicidade, integridade referencial) aplicadas no banco.
- Acesso validado por política de segurança de dados.
- Migrations validadas antes de aplicação.

## 8. ERROR HANDLING

- Erros de integridade traduzidos em respostas compreensíveis.
- Falhas de conexão tratadas com retry/fallback adequado.
- Erros registrados em log sem expor dados sensíveis.
- Transações revertidas em caso de falha.

## 9. ACCEPTANCE CRITERIA

- Dados são persistidos e recuperados conforme o contrato.
- Acesso não autorizado a dados é bloqueado.
- Constraints de integridade são respeitadas.
- Migrations são aplicáveis e reversíveis.
- Consultas retornam dados corretos e dentro dos limites esperados.
- Nenhum dado sensível vaza fora dos contratos autorizados.
