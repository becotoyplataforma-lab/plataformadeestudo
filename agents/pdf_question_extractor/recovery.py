# -*- coding: utf-8 -*-
"""Recuperacao de gabarito por corpo compartilhado, e marcacao de duplicatas.

A apostila imprime a mesma questao duas vezes: na secao Questoes Comentadas e
na Lista correspondente. Medido no documento (secao 1 = 100 itens e secao 18 =
100 itens; 2 = 61 e 19 = 61; 4 = 57 e 21 = 57; ...). As duas copias tem o
mesmo corpo, mas canais de gabarito diferentes:

* comentada  -> o veredito escrito no comentario;
* lista      -> a linha ``N. LETRA X`` / ``N. CORRETA`` do bloco GABARITO.

Quando um canal falha, o outro salva -- desde que o corpo bata. E quando os
dois canais divergem, isso e um dado do material, nao um ruído: a questao e
quarentenada com os dois valores registrados.

Nada aqui inventa gabarito: so propaga um valor que ja esta no PDF, com o
doador identificado no artefato para revisao humana.
"""

from __future__ import annotations

from .gabarito import Resolution
from .hashing import body_hash
from .parser import Questao


def _chave(q: Questao) -> str:
    return body_hash(q.enunciado, q.mapa_alternativas)


def indexar_por_corpo(questoes: list[Questao]) -> dict[str, list[Questao]]:
    """Agrupa questoes pelo hash de corpo (enunciado + alternativas)."""
    indice: dict[str, list[Questao]] = {}
    for q in questoes:
        if not q.enunciado:
            continue
        indice.setdefault(_chave(q), []).append(q)
    return indice


def recuperar_por_corpo(questoes: list[Questao]) -> dict[str, int]:
    """Propaga gabarito entre copias de mesmo corpo. Retorna contagens.

    Regras:

    * so propaga quando os doadores concordam entre si;
    * doador em conflito/anulada nao propaga nada;
    * a receptora registra ``origem_gabarito="corpo_duplicado"`` e
      ``doador_gabarito`` com o id_local de quem cedeu;
    * divergencia entre copias vira ``gabarito_conflito_entre_copias``.
    """
    indice = indexar_por_corpo(questoes)
    contadores = {
        "recuperados": 0,
        "conflitos_entre_copias": 0,
        "ainda_sem_gabarito": 0,
        "grupos_de_copia": 0,
    }
    for grupo in indice.values():
        if len(grupo) < 2:
            continue
        contadores["grupos_de_copia"] += 1
        valores = {
            q.resolucao.gabarito
            for q in grupo
            if q.resolucao is not None and q.resolucao.gabarito is not None
        }
        anuladas = [q for q in grupo if q.resolucao is not None and q.resolucao.anulada]
        if len(valores) > 1:
            for q in grupo:
                if q.resolucao is None or q.resolucao.gabarito is None:
                    q.problemas.append("gabarito_conflito_entre_copias")
                    if "gabarito_ausente" in q.problemas:
                        q.problemas.remove("gabarito_ausente")
                q.resolucao = Resolution(
                    None,
                    "copias_divergem",
                    original=" | ".join(sorted(valores)),
                    candidatos=tuple(sorted(valores)),
                    conflitado=True,
                )
            contadores["conflitos_entre_copias"] += 1
            continue
        if len(valores) == 1 and not anuladas:
            valor = next(iter(valores))
            doador = next(q for q in grupo if (q.resolucao and q.resolucao.gabarito == valor))
            for q in grupo:
                if q.resolucao is not None and q.resolucao.gabarito == valor:
                    q.doador_gabarito = q.doador_gabarito or None
                    continue
                q.resolucao = Resolution(valor, "corpo_duplicado", original=doador.id_local)
                q.origem_gabarito = "corpo_duplicado"
                q.doador_gabarito = doador.id_local
                if "gabarito_ausente" in q.problemas:
                    q.problemas.remove("gabarito_ausente")
                if "sem_chave_no_bloco_gabarito" in q.problemas:
                    q.problemas.remove("sem_chave_no_bloco_gabarito")
                contadores["recuperados"] += 1
    contadores["ainda_sem_gabarito"] = sum(
        1
        for q in questoes
        if q.resolucao is None or q.resolucao.gabarito is None
    )
    return contadores


def marcar_duplicatas(questoes: list[Questao]) -> dict[str, str]:
    """Mapeia ``id_local -> id_local_canonico`` para copias de mesmo corpo.

    A primeira copia na ordem do indice e a canonica. Questao sem enunciado e
    canonica de si mesma: sem corpo nao ha como afirmar que ela repetiu.
    """
    primeira_por_corpo: dict[str, str] = {}
    duplicatas: dict[str, str] = {}
    for q in questoes:
        if not q.enunciado:
            duplicatas[q.id_local] = q.id_local
            continue
        chave = _chave(q)
        canonica = primeira_por_corpo.setdefault(chave, q.id_local)
        duplicatas[q.id_local] = canonica
    return duplicatas
