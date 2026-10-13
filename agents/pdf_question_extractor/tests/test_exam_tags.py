# -*- coding: utf-8 -*-
"""Tags de prova: formas medidas no PDF, sem adivinhar papel."""

from __future__ import annotations

import re

import pytest

from agents.pdf_question_extractor.exam_tags import (
    desfazer_fragmentacao,
    eh_ancora_de_questao,
    eh_linha_de_chave,
    interpretar_ancora,
    interpretar_tag,
)

CASOS = {
    "1. (INOVERSASUL / PROFESSOR / 2025)": ("banca/cargo/ano", "INOVERSASUL", None, "PROFESSOR", 2025),
    "47. Prefeitura de Espera Feliz - MG / 2024": ("orgao/ano", None, "Prefeitura de Espera Feliz - MG", None, 2024),
    "24.(CISPAR / LABORATÓRIO / 2020) - Adaptada": ("banca/cargo/ano", "CISPAR", None, "LABORATÓRIO", 2020),
}


@pytest.mark.parametrize("ancora", list(CASOS))
def test_formas_medidas(ancora: str) -> None:
    esperado = CASOS[ancora]
    tag = interpretar_ancora(ancora)
    assert tag is not None
    assert (tag.classificacao, tag.banca, tag.orgao, tag.cargo, tag.ano) == esperado


def test_tag_com_sufixo_fora_dos_parenteses_nao_inventa_ano() -> None:
    tag = interpretar_tag("(TRT - 15ª Região - SP / 2025) - Utilize o texto da questão anterior")
    assert tag.ano == 2025
    assert tag.orgao == "TRT - 15ª Região - SP"
    assert tag.banca is None, "banca nao informada pelo material: nao pode ser chutada"
    assert any("utilize" in n.lower() for n in tag.notas)


def test_adaptada_fica_em_notas() -> None:
    tag = interpretar_tag("(CISPAR / LABORATÓRIO / 2020) - Adaptada")
    assert any("adaptada" in n.lower() for n in tag.notas)


def test_questao_inedita_perde_banca_e_nao_carrega_marca() -> None:
    tag = interpretar_ancora("46.(QUESTÃO INÉDITA / ESTRATÉGIA CONCURSOS / 2021)")
    assert tag is not None and tag.inedita
    assert tag.banca is None and tag.orgao is None and tag.cargo is None
    assert tag.ano == 2021
    serialized = " ".join(str(v) for v in tag.como_dict().values())
    assert not re.search(r"estrat[\u00e9ea]gia", serialized, re.IGNORECASE), serialized


def test_tag_sem_ano_e_classificada_como_sem_ano() -> None:
    tag = interpretar_tag("(FCC / ANALISTA)")
    assert tag.ano is None
    assert tag.classificacao.endswith("_sem_ano")


def test_quatro_segmentos_nao_recebe_papel_forcado() -> None:
    tag = interpretar_tag("(A / B / C / 2020)")
    assert tag.classificacao == "indefinida"
    assert tag.banca is None


def test_fragmentacao_reconstruída_em_uma_linha() -> None:
    linhas = [
        (10, "20. (PREFEITURA DE X - MG /"),
        (10, "09.2025. Adaptado)"),
        (11, "21. (A / B / 2020)"),
    ]
    saida = desfazer_fragmentacao(linhas)
    assert len(saida) == 2
    assert "09.2025" in saida[0][1]
    tag = interpretar_ancora(saida[0][1])
    assert tag is not None and tag.ano == 2025


def test_ancora_exige_sequencia() -> None:
    linha = "1. (INOVERSASUL / PROFESSOR / 2025)"
    assert eh_ancora_de_questao(linha, 1)
    assert not eh_ancora_de_questao(linha, 2)


def test_falso_positivo_de_comentario_nao_e_ancora() -> None:
    #: Medido: 322 linhas `N.` de regras mnemonicas dentro dos comentarios.
    assert not eh_ancora_de_questao("1. Com os prefixos Recém, além, aquém, sem, ex, vice, HÁ HIFEN SEMPRE!", 1)


@pytest.mark.parametrize(
    "corpo", ["LETRA A", "LETRA B", "CORRETA", "INCORRETA", "ANULADA", "ERRADO", "Verdadeiro"]
)
def test_linhas_de_chave_nunca_sao_ancoras(corpo: str) -> None:
    assert eh_linha_de_chave(corpo)
    assert not eh_ancora_de_questao(f"7. {corpo}", 7)


def test_ancora_de_forma_bare_slash_e_aceita() -> None:
    assert eh_ancora_de_questao("47. Prefeitura de Espera Feliz - MG / 2024", 47)
