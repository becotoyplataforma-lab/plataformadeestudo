# Flashcards — Gerar Flashcards de um Tópico
# v1.0 — 2026-08-04
# Placeholders: {{topico}}, {{quantidade}}, {{nivel}}

Gere {{quantidade}} flashcards de estudo (repetição espaçada) sobre o tópico
**{{topico}}**, para nível {{nivel}}.

## Regras de conteúdo

- Frente = pergunta/afirmação incompleta (curta, direta).
- Verso = resposta objetiva com o fundamento (lei/artigo/súmula) quando
  aplicável.
- Priorize os pontos MAIS COBRADOS e as pegadinhas mais frequentes.
- Inclua pelo menos 2 flashcards do tipo "certo/errado" com justificativa.
- Não crie flashcards triviais ou óbvios.

## Formato de saída (JSON válido)

```json
[
  {
    "front": "Pergunta da frente",
    "back": "Resposta do verso",
    "tags": ["constitucional", "direitos-fundamentais"]
  }
]
```
