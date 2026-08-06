# module.contract.md

> Contrato genérico de um **Módulo** — unidade coesa e independente de funcionalidade.

## 1. PURPOSE

- Definir uma unidade de funcionalidade com fronteira bem delimitada.
- Encapsular um conjunto coeso de regras, dados e interfaces relacionados a um domínio.
- Permitir evolução e substituição de um módulo sem afetar os demais.

## 2. RESPONSIBILITIES

- Expor um conjunto limitado e bem definido de operações públicas.
- Orquestrar as camadas internas (fronteira, regra de negócio, dados).
- Isolar o domínio de dependências externas.
- Garantir que toda interação externa ocorra por contratos explícitos.

## 3. INPUT

- Entradas provenientes exclusivamente das fronteiras do módulo.
- Dados de entrada devem ser declarados de forma explícita e tipada.
- Nenhuma entrada deve ser aceita sem validação.

## 4. OUTPUT

- Saídas padronizadas e tipadas.
- Nunca expor estruturas internas ou dados brutos não autorizados.
- Toda saída deve respeitar o contrato de dados definido para o módulo.

## 5. DEPENDENCIES

- Dependências explícitas e declaradas.
- Dependências externas acessadas apenas por adaptadores/contratos, nunca diretamente no domínio.
- Substituição de dependência sem alterar o contrato do módulo.

## 6. RULES

- Um módulo possui uma única responsabilidade de domínio.
- Não acessar diretamente recursos externos fora de suas camadas autorizadas.
- Não duplicar responsabilidades de outros módulos.
- Alterações internas não devem violar contratos públicos.
- Independência entre módulos: comunicação apenas por interfaces estáveis.

## 7. VALIDATIONS

- Toda entrada é validada na fronteira do módulo.
- Regras de domínio são validadas antes de qualquer persistência ou efeito colateral.
- Validações falhas não geram efeitos parciais.

## 8. ERROR HANDLING

- Erros são tratados dentro do módulo e traduzidos para mensagens compreensíveis.
- Nenhum erro interno é exposto cru à fronteira.
- Falhas são registradas em log com contexto suficiente para diagnóstico.

## 9. ACCEPTANCE CRITERIA

- O módulo é utilizável exclusivamente por meio de suas operações públicas.
- Entradas inválidas são rejeitadas com feedback claro.
- Saídas seguem o contrato tipado e padronizado.
- O módulo pode ser testado isoladamente.
- Substituir uma dependência interna não altera o comportamento observável.
