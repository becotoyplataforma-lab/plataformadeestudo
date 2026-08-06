# ETL — Explicação Automática de Questão (Batch)
# v1.0 — 2026-08-04
# Placeholders: {{enunciado}}, {{alternativas}}, {{gabarito}}, {{banca}}, {{materia}}

Escreva o comentário do gabarito (explicação) para a questão abaixo, no
padrão dos melhores cursos preparatórios do Brasil.

## Requisitos da explicação

- Título curto com o tema (máx. 60 caracteres).
- Parágrafo único cobrindo: fundamento legal/doutrinário, por que o gabarito
  está correto.
- 1 frase apontando o erro do distrator mais tentador (se houver).
- Tom direto, sem rodeios, adequado para leitura rápida.
- Cite artigos/leis apenas se estiverem corretos.

## Formato de saída

```
**Tema:** <tema>

<explicação em 3-5 frases>

**Distrator mais comum:** <o que confunde os candidatos e por que está errado>
```

---

**Banca:** {{banca}} | **Matéria:** {{materia}}
**Enunciado:**
{{enunciado}}

**Alternativas:**
{{alternativas}}

**Gabarito:** {{gabarito}}
