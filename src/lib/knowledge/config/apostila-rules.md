# Regras editoriais de transformacao de apostilas

Arquivo versionado no repositorio. `apostila-rules.schema.ts` faz o parse e a
validacao Zod; `apostila-transformer.service.ts` aplica o que esta aqui.
Edite este arquivo e faca reprocessar: nenhuma linha de codigo muda.

## Como o arquivo e lido

- O bloco `---` no topo contem os escalares. Valor malformado invalida o lote
  inteiro: nesse caso o pipeline cai nas regras compiladas (`source: "compilado"`
  no relatorio) e registra o aviso, em vez de processar com regra pela metade.
- Cada secao `##` com lista `-` e uma regra de vocabulario. Os itens sao
  **literais**, nunca regex: o codigo escapa e monta o padrao. Um arquivo nao
  pode injetar expressao arbitraria no processo (ReDoS e perda silenciosa de
  conteudo).
- A cache de leitura e por `mtime` + tamanho. Trocou o arquivo, a proxima
  transformacao ja le o novo conteudo; sem isso o processo longo ficava preso
  na primeira versiao lida.
- Em deploy empacotado (Next standalone) o caminho padrao pode nao existir.
  Aponte `APOSTILA_RULES_PATH` para uma copia lida em disco, ou aceite o
  fallback compilado. Fallback e visivel no relatorio: nada roda em silencio.

## O que estas regras NAO fazem

Nenhum vocabulario aqui remove autoria, marca de plataforma, assinatura, URL,
dominio, copyright ou identificacao de origem. Isso esta em `AGENTS.md` (linhas
43-45), em `docs/KNOWLEDGE_PIPELINE.md` (linha 59) e no contrato do provedor.
Redacao de PII apaga **dado pessoal de terceiros** (CPF, matricula, nome do
comprador); nao apaga quem fez o material. As duas coisas nao sao a mesma regra
e nao podem ser confundidas num ajuste de vocabulario.

Tambem nao existe aqui regra de expansao de conteudo. A IA reorganiza e nao
inventa: ver `apostila-structurer.service.ts`, que rejeita saida com menos
questoes ou sem as marcas de procedencia da entrada.

```yaml
---
versao: 2026-10-18.1
modo: sanitize-only
pii: ativado
estrutura: ativado
aviso_ia_quando_llm: ativado
marca_redacao: [REDACTADO]
llm_max_chars: 32000
llm_temperature: 0.4
---
```

## campos_pii

Rotulos de campo. A linha `Rotulo: valor` e redigida no valor, e o rotulo fica
no lugar para o leitor saber que havia algo ali. So entra redacao se o valor
tiver cara de identificador (digitos) ou de nome, conforme o tipo: linha de prosa
como `Inscricao: o candidato devera comparecer` nao e tocada.

- cpf: cpf
- matricula: matricula, matricula funcional, registro funcional, registro,
  inscrição, inscricao, insc, numero de inscrição, codigo de identificacao,
  codigo de matricula, id funcional
- identidade: rg, rss, cedula de identidade, identidade
- conselho: oab, crp, crc, coren, cra, cref
- carteira: cnh
- nome: aluno, nome do aluno, nome do candidato, candidato, estudante,
  participante, comprador, titular, licenca pessoal

## marcadores_questao

Usados como gate de qualidade: se a saida da IA tiver menos marcadores que a
entrada, a saida e rejeitada e o documento cai em `sanitize-only`. Questao
comentada preservada e medido, nao prometido.

- questao
- questoes
- exercicio
- exercicios
- prova comentada
- gabarito comentado

## marcas_de_procedencia

Sentido contrario ao das outras secoes: estas palavras **precisam continuar
presentes** depois de qualquer passagem de IA. Se a IA apagar `Estrategia` de um
material que tinha `Estrategia`, a saida e descartada e o motivo vira aviso no
relatorio. A lista e de deteccao, nao de remocao.

- estrategia
- gran
- direcao
- alfacon
- cers
- qconcursos
- faculdade conservador
- admiratus
- transversale
