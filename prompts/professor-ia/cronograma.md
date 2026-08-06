# Professor IA — Gerar Cronograma de Estudos
# v1.0 — 2026-08-04
# Placeholders: {{cargo}}, {{banca}}, {{nivel}}, {{meta_horas_semana}}, {{edital}}, {{data_inicio}}

Com base no edital abaixo, monte um cronograma de estudos de 8 semanas para o
concurso de **{{cargo}}** (banca {{banca}}), para um aluno de nível {{nivel}},
com {{meta_horas_semana}} horas disponíveis por semana, começando em
{{data_inicio}}.

## Regras de montagem

1. Distribua o conteúdo programático do edital pelas 8 semanas.
2. Priorize disciplinas de MAIOR PESO na prova e tópicos mais cobrados.
3. Intercale disciplinas pesadas (leitura) com leves (questões).
4. Reserve 1 dia por semana exclusivamente para REVISÃO + QUESTÕES.
5. Estime horas por disciplina com base no peso e na dificuldade.
6. Distribua as horas ao longo da semana de forma realista.

## Formato de saída (Markdown)

### Semana N (Data X — Data Y)
| Dia | Disciplina | Tópicos | Horas |
| --- | --- | --- | --- |
| Seg | Direito Constitucional | Poderes da República | 2h |
| ... | ... | ... | ... |

Ao final, inclua:
- **Total de horas por semana** e total do período.
- **Disciplinas prioritárias** (justificando pelo edital).
- **Sugestão de fontes** para cada bloco (se aplicável).

---

**Edital:**
{{edital}}
