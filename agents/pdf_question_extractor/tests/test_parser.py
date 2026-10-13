# -*- coding: utf-8 -*-
"""Parser: ancoragem, alternativas inline, grupos, chaves e tipo de item.

Os fixtures reproduzem as formas medidas no PDF (ver o docstring do modulo),
para que o teste rode sem depender do arquivo de 862 paginas.
"""

from __future__ import annotations

from agents.pdf_question_extractor.parser import (
    _dividir_blocos,
    _dividir_grupos,
    _eh_item_certo_errado,
    _sequencia_de_alternativas,
    extrair_chaves,
)
from agents.pdf_question_extractor.sections import Secao

SECAO = Secao(numero=1, tipo="comentada", tema="Ortografia", pagina_inicial=4, pagina_final=53)
SECAO_LISTA = Secao(numero=18, tipo="lista", tema="Ortografia", pagina_inicial=550, pagina_final=577)


def test_alternativas_em_linhas_separadas() -> None:
    bloco = [
        "Assinale a alternativa correta.",
        "A) primeira.",
        "B) segunda.",
        "C) terceira.",
        "D) quarta.",
        "E) quinta.",
    ]
    enunciado, alts, comentario = _dividir_blocos(bloco)
    assert enunciado == ["Assinale a alternativa correta."]
    assert [a.letra for a in alts] == list("ABCDE")
    assert alts[0].texto == "primeira."
    assert comentario == []


def test_alternativas_inline_no_fim_do_enunciado() -> None:
    """Forma real medida: o texto acaba e as cinco opcoes vem na mesma linha."""
    bloco = [
        "O conectivo em destaque mantém com o trecho anterior relação de",
        "apesar B) como C) embora D) porque E) portanto",
    ]
    enunciado, alts, _ = _dividir_blocos(bloco)
    assert [a.letra for a in alts] == ["B", "C", "D", "E"]
    assert alts[0].texto == "como"
    assert alts[-1].texto == "portanto"
    assert "relação de" in enunciado[0]


def test_alternativas_minusculas() -> None:
    bloco = ["Qual é a correta?", "a) um", "b) dois", "c) três", "d) quatro"]
    _, alts, _ = _dividir_blocos(bloco)
    assert [a.letra for a in alts] == list("ABCD")


def test_marca_dentro_de_frase_nao_vira_alternativa() -> None:
    #: Sem sequencia A)->B) nao ha corrida: nada e partido.
    texto = "O item (B) está correto, mas o enunciado continua."
    assert _sequencia_de_alternativas(texto) == []


def test_comentario_interrompe_a_coleta_de_alternativas() -> None:
    """O comentario reproduz as opcoes; aceitar isso duplicaria alternativas."""
    bloco = [
        "Enunciado.",
        "A) um",
        "B) dois",
        "Comentários:",
        "A) um está errada porque X.",
        "C) três Gabarito: Letra C.",
    ]
    _, alts, comentario = _dividir_blocos(bloco)
    assert [a.letra for a in alts] == ["A", "B"]
    #: O rotulo "Comentarios:" e consumido, nao guardado.
    assert comentario == ["A) um está errada porque X.", "C) três Gabarito: Letra C."]
    assert alts[0].texto == "um"


def test_mencao_de_gabarito_nao_fica_na_alternativa() -> None:
    bloco = ["Item.", "A) um", "B) dois", "d) O homem dialogava COM a mulher. Gabarito letra D."]
    _, alts, _ = _dividir_blocos(bloco)
    assert all("Gabarito" not in a.texto for a in alts)


def test_grupo_se_para_na_linha_de_gabarito() -> None:
    corpo = [
        (1, "1. (BANCA / CARGO / 2024)"),
        (1, "Enunciado um."),
        (1, "GABARITO"),
        (1, "1. LETRA A"),
        (1, "2. LETRA B"),
        (2, "2. (BANCA / CARGO / 2024)"),
        (2, "Enunciado dois."),
    ]
    grupos = _dividir_grupos(corpo)
    assert len(grupos) == 2
    assert extrair_chaves(grupos[0][1])[1].gabarito == "A"


def test_grupo_se_para_no_reinicio_sem_linha_de_gabarito() -> None:
    """Medido na secao 4: 7. (...) e logo depois 0. (...), sem GABARITO."""
    corpo = [
        (1, "6. (A / B / 2024)"),
        (1, "seis"),
        (1, "7. (A / B / 2024)"),
        (1, "sete"),
        (1, "0. (CRO RR / AGENTE / 2024)"),
        (1, "zero"),
        (1, "1. (IPEA / Analista / 2024)"),
        (1, "um novo"),
    ]
    grupos = _dividir_grupos(corpo)
    assert len(grupos) == 2
    assert [ln for _, ln in grupos[0][0]] == ["6. (A / B / 2024)", "seis", "7. (A / B / 2024)", "sete"]
    #: O 1. seguinte nao abre grupo novo: 1 > 0, a sequencia continua dentro do grupo.
    assert grupos[1][0][0][1].startswith("0.")
    assert len(grupos[1][0]) == 4


def test_item_certo_errado_explícito() -> None:
    from agents.pdf_question_extractor.parser import Alternativa

    assert _eh_item_certo_errado(
        [Alternativa("C", "Certo"), Alternativa("E", "Errado")]
    )
    #: Um par escrito sem acento nem pontuacao tambem conta.
    assert _eh_item_certo_errado(
        [Alternativa("C", "correto."), Alternativa("E", "incorreta")]
    )


def test_chaves_de_lista_nas_formas_reais() -> None:
    linhas = [
        (1, "1. LETRA A"),
        (2, "2. ERRADO"),
        (3, "3. CORRETA"),
        (12, "12.LETRA B"),
        (4, "4. ANULADA"),
        (5, "5. LETRA B/E"),
    ]
    chaves = extrair_chaves(linhas)
    assert chaves[1].gabarito == "A"
    assert chaves[2].gabarito == "E"
    assert chaves[3].gabarito == "C"
    assert chaves[12].gabarito == "B"
    assert chaves[4].anulada
    assert chaves[5].conflitado


def test_c_e_invertido_nao_passa_como_legitimo() -> None:
    from agents.pdf_question_extractor.parser import Alternativa

    assert not _eh_item_certo_errado(
        [Alternativa("C", "Errado"), Alternativa("E", "Certo")]
    )


def test_secao_como_faixa_de_paginas() -> None:
    assert SECAO.range_indice() == range(3, 53)
    assert SECAO.id_prefixo == "S01"
