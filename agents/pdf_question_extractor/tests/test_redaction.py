# -*- coding: utf-8 -*-
"""Portao de PII/marca: precisao acima de amplitude.

Os casos sao os erros que a varredura larga cometeria neste PDF real:
URL com 11 digitos e autores citados nao podem derrubar a geracao, e o CPF
do comprador tem de derrubar.
"""

from __future__ import annotations

import pytest

from agents.pdf_question_extractor.redaction import (
    PIIEmArtefato,
    cpf_valido,
    exigir_limpo,
    vistoriar,
)


@pytest.mark.parametrize(
    "digitos, valido",
    [
        ("05201664776", True),   # CPF real da linha de rodape do material
        ("46675766891", False),  # id de URL de citacao, nao e CPF
        ("11111111111", False),  # repetido
        ("12345678901", False),
    ],
)
def test_validacao_de_modulo_11(digitos: str, valido: bool) -> None:
    assert cpf_valido(digitos) is valido


def test_cpf_validoBloqueia_e_url_entrada_aviso() -> None:
    v = vistoriar("dado 05201664776 aqui")
    assert not v.limpo
    assert [a.padrao for a in v.bloqueantes] == ["cpf_valido"]

    aviso = vistoriar("http://deposito-de-tirinhas.tumblr.com/post/46675766891/x")
    assert aviso.limpo, "URL de citacao nao pode derrubar a geracao"
    assert any(a.padrao == "sequencia_11_digitos" for a in aviso.avisos)


def test_autor_citado_nao_e_pii() -> None:
    #: O plano antigo varria nomes; isso mataria questões legítimas.
    v = vistoriar(
        "(VERÍSSIMO, Luís Fernando. Novas comédias da vida privada). "
        "Vinicius de Moraes. Para viver um grande amor."
    )
    assert v.limpo


def test_marca_de_plataforma_bloqueia() -> None:
    for texto in (
        "www.estrategiaconcursos.com.br",
        "Equipe Português Estratégia Concursos",
        "QUESTÃO INÉDITA / ESTRATÉGIA CONCURSOS / 2021",
    ):
        assert not vistoriar(texto).limpo, texto


def test_marca_dagua_do_pdf_bloqueia() -> None:
    assert not vistoriar("==b9955==").limpo


def test_proibida_por_identidade_bloqueia_sem_hardcode() -> None:
    linha = "05201664776 - Fulano da Silva"
    assert vistoriar("alguma coisa", proibidas=[linha]).limpo
    v2 = vistoriar("rodape: " + linha, proibidas=[linha])
    assert not v2.limpo
    #: A mesma linha pode cair em dois padroes; o que importa e o conjunto.
    assert {"mobilia_reincidente", "cpf_valido"} <= {a.padrao for a in v2.bloqueantes}
    #: Sem a linha proibida declarada, o CPF sozinho ja barra.
    assert not vistoriar(linha).limpo


def test_exigir_limpo_levanta_com_nome_do_artefato() -> None:
    v = vistoriar("05201664776")
    with pytest.raises(PIIEmArtefato) as exc:
        exigir_limpo("questoes_aula_14.json", v)
    assert "questoes_aula_14.json" in str(exc.value)


def test_recorte_do_trecho_nao_reintroduz_dado_inteiro() -> None:
    segredo = "x" * 200
    v = vistoriar(segredo, proibidas=[segredo])
    assert all(len(a.trecho) <= 51 for a in v.bloqueantes)
