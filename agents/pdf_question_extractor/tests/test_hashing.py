# -*- coding: utf-8 -*-
"""Fidelidade do hash frente ao QuestionImportService real (TS).

Os vetores de ``golden_hash.json`` sao produzidos por ``_gerar_golden.mjs``,
que contem copia literal de ``computeHash``/``normalizeGabarito``/
``parseQuestion``. Testar contra esse arquivo e o que impede a deriva de
hash, e por extensao a duplicacao de questoes no banco.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from agents.pdf_question_extractor.hashing import (
    IMPORT_LETTERS,
    build_hash_body,
    content_hash,
    content_hash_from_import_row,
    flattened_hash_fields,
    import_row_fields,
    normalize_for_hash,
)

GOLDEN = Path(__file__).with_name("golden_hash.json")


def _golden() -> dict:
    return json.loads(GOLDEN.read_text(encoding="utf-8"))


@pytest.mark.parametrize("vector", _golden()["raw"], ids=lambda v: v["body"][:38])
def test_content_hash_bate_com_o_ts(vector: dict) -> None:
    assert content_hash(vector["enunciado"], vector["alternativas"], vector["gabarito"]) == vector["hash"]


@pytest.mark.parametrize("vector", _golden()["raw"], ids=lambda v: v["body"][:38])
def test_corpo_normalizado_bate_com_o_ts(vector: dict) -> None:
    """Compara o intermediario, nao so o digest: hash igual por colisao de
    erro de transcricao nao pode passar despercebido."""
    corpo = build_hash_body(vector["enunciado"], vector["alternativas"], vector["gabarito"])
    assert normalize_for_hash(corpo) == vector["normalized"]


@pytest.mark.parametrize("vector", _golden()["import"], ids=range(len(_golden()["import"])))
def test_content_hash_do_caminho_de_importacao_bate_com_o_ts(vector: dict) -> None:
    values, esperado = vector["values"], vector["hash"]
    alternatives = {f"{letra}": values.get(f"alt_{letra.lower()}") or "" for letra in IMPORT_LETTERS}
    gabarito = vector["parsed"]["gabarito"]
    assert content_hash_from_import_row(values["enunciado"], alternatives, gabarito) == esperado


def test_ordem_dos_campos_altera_o_hash() -> None:
    """A ordem enunciado || A:.. || ... || gabarito e parte do contrato."""
    base = content_hash("pergunta", [("A", "x"), ("B", "y")], "A")
    outra_ordem = content_hash("pergunta", [("B", "y"), ("A", "x")], "A")
    gab_diferente = content_hash("pergunta", [("A", "x"), ("B", "y")], "B")
    assert base != outra_ordem
    assert base != gab_diferente


def test_normalizacao_preserva_espacos_de_borda() -> None:
    """O TS nao faz trim final; \\s+ colapsa mas a borda continua no hash."""
    assert normalize_for_hash("  a  b  ") == " a b "
    assert normalize_for_hash("  a  b  ").startswith(" ")
    assert normalize_for_hash("  a  b  ").endswith(" ")


def test_apenas_bloco_u0300_u036f_e_removido() -> None:
    assert normalize_for_hash("Questões á") == "questoes a"
    #: U+0327 esta DENTRO do bloco (807) e e removido, como no JS.
    assert normalize_for_hash("a\u0327b") == "ab"
    #: U+0483 e Mn mas esta fora do bloco: precisa sobreviver.
    assert normalize_for_hash("a\u0483b") == "a\u0483b"


def test_build_hash_body_tem_gabarito_como_ultimo_campo() -> None:
    body = build_hash_body("E", {"A": "a", "C": "c"}, "C")
    assert body == "E||A:a||C:c||C"


def test_flattened_hash_fields_espelha_trim_e_descarte_do_ts() -> None:
    enun, alts, gab = flattened_hash_fields("  oi  ", {"A": " x ", "B": "   ", "C": " y "}, " A ")
    assert enun == "oi"
    assert alts == [("A", "x"), ("C", "y")]
    assert gab == "A"


def test_import_row_usa_chaves_reconhecidas_pelo_resolve_column() -> None:
    """``alt_a`` nao e alias valido; so ``a``/``alternativa_a``/``opcao_a``/``option_a``."""
    row = import_row_fields("e", {"A": "x", "E": "y"}, "E")
    assert row["alternativa_a"] == "x"
    assert row["alternativa_e"] == "y"
    assert "alt_a" not in row
    for chave in row:
        assert chave in {"enunciado", "gabarito", "explicacao", "nivel", "ano", "banca", "cargo", "fonte", "topic"} or chave.startswith("alternativa_")
