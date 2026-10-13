# -*- coding: utf-8 -*-
"""Proveniência: o que se sabe, de onde se sabe, e o que se recusa a afirmar.

Cinco estados, derivados do material e nunca de suposição:

``oficial_prova``
    a tag do PDF nomeia banca e/ou órgão de prova.
``inedita_compilador``
    a tag diz ``QUESTÃO INÉDITA``: o item é autoria do compilador, não cai de
    prova alguma. Vai para quarentena e fica fora do import.
``gabarito_inconclusivo``
    gabarito ausente, anulado, em conflito entre comentário e bloco
    ``GABARITO``, ou divergente entre cópias da mesma questão.
``estrutura_incompleta``
    faltam enunciado ou alternativas suficientes para existir importável.
``revisao_pendente``
    nada acima, mas nada foi conferido por humano ainda -- é o estado padrão
    de todo item extraído.

``ALVO_APOSTILA``:
    O cabeçalho do material diz ``CBM-PE (Soldado)``. Isto não é o órgão da
    banca nem da questão; é a prova-alvo da apostila. Manter as duas coisas
    separadas é o que impede o pipeline de fabricar metadado ``CBM-RJ`` que o
    PDF não contém.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover
    from .parser import Questao

#: Estados possíveis de proveniência.
OFICIAL_PROVA = "oficial_prova"
INEDITA_COMPILADOR = "inedita_compilador"
GABARITO_INCONCLUSIVO = "gabarito_inconclusivo"
ESTRUTURA_INCOMPLETA = "estrutura_incompleta"
REVISAO_PENDENTE = "revisao_pendente"

#: Problemas que significam "falta estrutura para existir no banco".
_SEM_ESTRUTURA = {
    "enunciado_vazio",
    "alternativas_insuficientes",
    "alternativas_repetidas",
    "alternativa_com_marca_de_letra",
}
#: Problemas que significam "não sabemos a resposta".
_SEM_GABARITO = {
    "gabarito_ausente",
    "gabarito_conflitante",
    "gabarito_anulado",
    "gabarito_fora_das_alternativas",
    "gabarito_conflito_entre_copias",
    "sem_chave_no_bloco_gabarito",
}


def proveniencia_de(q: "Questao") -> str:
    """Classifica a proveniência de um item extraído."""
    problemas = set(q.problemas)
    if q.inedita or "conteudo_do_compilador" in problemas:
        return INEDITA_COMPILADOR
    if problemas & _SEM_ESTRUTURA:
        return ESTRUTURA_INCOMPLETA
    if problemas & _SEM_GABARITO:
        return GABARITO_INCONCLUSIVO
    if q.tag.banca or q.tag.orgao:
        return OFICIAL_PROVA
    return REVISAO_PENDENTE


def proveniencia_dict(q: "Questao") -> dict[str, object]:
    """Proveniência legível para revisão humana, com ponteiro de página."""
    return {
        "estado": proveniencia_de(q),
        "origem_gabarito": q.origem_gabarito,
        "doador_gabarito": q.doador_gabarito,
        "classificacao_tag": q.tag.classificacao,
        "tag_crua": q.tag.crua,
        "paginas": [q.pagina_inicial, q.pagina_final],
        "secao": q.secao.numero,
        "grupo": q.grupo,
        "numero_original": q.numero_original,
        "editado_por_humano": False,
    }
