# -*- coding: utf-8 -*-
"""Blindagem do gabarito: letra sempre, palavra nunca.

Os casos "perigosos" sao verificados contra a replica do ``normalizeGabarito``
do importador e contra o ``golden_hash.json`` gerado pelo TS real.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from agents.pdf_question_extractor.gabarito import (
    CERTO_ERADO_ALTERNATIVAS,
    GabaritoInseguro,
    gabarito_importavel,
    normalizar_chave_lista,
    palavra_para_letra,
    resolver_de_blocos,
    ts_normalize_gabarito_replica,
)

GABARITO_TS = json.loads(
    Path(__file__).with_name("golden_hash.json").read_text(encoding="utf-8")
)["gabarito"]


def test_replica_python_do_ts_bate_com_o_ts() -> None:
    for entrada, saida in GABARITO_TS.items():
        assert ts_normalize_gabarito_replica(entrada or None) == saida, entrada


@pytest.mark.parametrize(
    "palavra, esperado",
    [
        ("Correto.", "E"),
        ("Certo.", "E"),
        ("Errado.", "D"),
        ("Verdadeiro.", "E"),
        ("Incorreto.", "E"),
    ],
)
def test_palavra_por_extenso_seria_corrompida(palavra: str, esperado: str) -> None:
    """Documenta o veneno: estas entradas jamais podem ir ao JSON de import."""
    assert ts_normalize_gabarito_replica(palavra) == esperado


def test_mapeamento_seguro_de_palavras() -> None:
    assert palavra_para_letra("Correto.") == "C"
    assert palavra_para_letra("correta") == "C"
    assert palavra_para_letra("Errado.") == "E"
    assert palavra_para_letra("incorreta") == "E"
    assert palavra_para_letra("Verdadeiro") == "C"
    assert palavra_para_letra("Falsa") == "E"


def test_alternativas_sinteticas_de_certo_errado() -> None:
    assert CERTO_ERADO_ALTERNATIVAS == {"C": "Certo", "E": "Errado"}
    #: As letras C/E precisam sobreviver ao importador intactas.
    assert gabarito_importavel("C") == "C"
    assert gabarito_importavel("E") == "E"


@pytest.mark.parametrize("palavra", ["Certo", "Errado", "Correto.", "QUESTÃO CORRETA"])
def test_gabarito_importavel_recusa_palavra(palavra: str) -> None:
    with pytest.raises(GabaritoInseguro):
        gabarito_importavel(palavra)


@pytest.mark.parametrize(
    "linha, letra, metodo",
    [
        ("LETRA A", "A", "letra"),
        ("Letra D.", "D", "letra"),
        ("CORRETA", "C", "palavra"),
        ("INCORRETA", "E", "palavra"),
        ("E", "E", "letra"),
        ("verdadeiro", "C", "palavra"),
    ],
)
def test_chave_de_lista(linha: str, letra: str, metodo: str) -> None:
    res = normalizar_chave_lista(linha)
    assert res.gabarito == letra, res
    assert res.metodo == metodo


def test_chave_ambigua_e_anulada_vao_para_quarentena() -> None:
    amb = normalizar_chave_lista("LETRA B/E")
    assert amb.conflitado and amb.gabarito is None
    assert amb.motivo_quarentena == "gabarito_conflitante"
    anu = normalizar_chave_lista("ANULADA")
    assert anu.anulada and anu.motivo_quarentena == "gabarito_anulado"


def test_resolucao_inline_sem_dois_pontos() -> None:
    """A maioria dos gabaritos no PDF nao usa ``Gabarito:``."""
    bloco = [
        "Identificam-se no voca\u0302bulo oito letras.",
        "Nesse caso, temos di\u0301fono. Gabarito: Errado.",
    ]
    res = resolver_de_blocos(bloco)
    assert res.gabarito == "E"
    assert res.metodo == "palavra"


def test_resolucao_por_conclusao_autonoma() -> None:
    res = resolver_de_blocos(["O item esta errado.", "Questão incorreta."])
    assert res.gabarito == "E"


def test_resolucao_letra_com_verbo() -> None:
    res = resolver_de_blocos(["O gabarito é a letra E."])
    assert res.gabarito == "E"


def test_conflito_de_candidatos_nao_e_silenciado() -> None:
    res = resolver_de_blocos(["Gabarito: Letra C.", "Questão incorreta."])
    assert res.conflitado
    assert res.gabarito is None
    assert set(res.candidatos) == {"C", "E"}


def test_bloco_sem_gabarito_fica_ausente() -> None:
    res = resolver_de_blocos(["apenas o enunciado", "A) x", "B) y"])
    assert res.gabarito is None
    assert res.motivo_quarentena == "gabarito_ausente"
