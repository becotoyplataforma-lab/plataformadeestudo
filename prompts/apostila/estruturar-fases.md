# Transformação de apostila em fases (camada de indexação)

Você está reorganizando o texto de uma apostila para entrar no índice de
conhecimento da plataforma. O resultado é **Markdown puro**, sem `<html>`, sem
comentário seu antes ou depois do documento.

Arquivo: `{{apostila_arquivo}}`
Modo: `{{modo}}`
- `structure`: dividir em fases temáticas progressivas. Nada além disso.
- `full`: dividir em fases e remarcar caixas de destaque pedagógico.

## Regras obrigatórias

1. **Nenhum conteúdo é removido.** Título, matéria, número da aula, autoria,
   nome da plataforma, assinatura do professor, URLs, domínios, redes sociais e
   avisos de direitos continuam no texto, exatamente como vieram. Retirar
   titularidade não é edição: é ocultação de autoria, e é vedado por política do
   projeto.
2. **Nenhum conteúdo é inventado.** Não acrescente exemplos, analogias,
   exercícios ou explicações que não estejam na entrada. Reorganizar é permitido;
   completar é proibido.
3. **100% das questões comentadas são preservadas**, com enunciado, alternativas,
   gabarito e justificativa. Se uma questão não couber na fase onde está, ela vai
   para o fim do documento numa seção `## Questões comentadas`, nunca é resumida.
4. Cada seção `Fase NN - Tema` vira cabeçalho `## Fase NN - Tema`. Mantenha a
   numeração original e não crie fases que não existiam no material.
5. Caixas de destaque entram como blockquote com rótulo em negrito, usando só os
   rótulos que o próprio texto permite:
   - `> **REGRA** - ...` para regra gramatical, legal ou conceitual essencial.
   - `> **ATENÇÃO** - ...` para ponto recorrente de prova.
   - `> **DICA** - ...` para macete ou atalho de memorização já dito no material.
   - `> **CUIDADO** - ...` para pegadinha ou erro comum de banca já apontado.
   Um trecho só recebe rótulo se essa for a natureza dele no texto de origem. Não
   transforme prosa comum em caixa de destaque.
6. Quadros, tabelas e diagramas viram tabelas Markdown com o mesmo conteúdo.
   Nada de "ver original": a informação tem de estar na tabela.
7. O texto já passou por redação automática de dados pessoais (CPF, matrícula,
   nome do comprador). Se encontrar `[REDACTADO]`, deixe como está: não tente
   completar nem adivinhar o valor.
8. Não escreva introdução, conclusão, resumo executivo ou nota sobre o processo.
   Comece no primeiro cabeçalho do documento.

## Saída

Comece e termine em `##`. Sem preâmbulo, sem posfácio, sem bloco de código
envolvendo o documento inteiro.

---

## Conteúdo

{{apostila_conteudo}}
