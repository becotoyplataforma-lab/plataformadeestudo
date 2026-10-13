# -*- coding: utf-8 -*-
"""Serializacao dos artefatos da Aula 14.

Todo artefato nasce em estado de revisao e nao publicado:

* ``status = "em_revisao"``, ``origin = "import"``, ``isPublic = False``
* ``explicacao = None`` -- o comentario do compilador NAO vai para artefato
  publico nem para import; ele so existe no arquivo LOCAL gitignoreado.
* ``resolucao_status = "pendente_geracao"`` -- resolucao por IA ainda nao foi
  gerada (sem credencial de provedor, nao se finge que foi).

Metadado e o que o PDF diz. O que ele nao diz fica ``None``: ``banca`` de item
com tag de dois segmentos, ``nivel``, ``links``. Nada de "CBM-RJ" inventado --
o material e para ``CBM-PE (Soldado)``, e rota de estudo do usuario nao e
metadado da questao.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .gabarito import CERTO_ERADO_ALTERNATIVAS, gabarito_importavel
from .hashing import body_hash, content_hash_from_import_row, import_row_fields
from .parser import Questao
from .provenance import proveniencia_de, proveniencia_dict

DISCIPLINA = "Língua Portuguesa"
#: Alvo declarado no proprio PDF. Nao e orgao de banca, e nao e "CBM-RJ".
ALVO_APOSTILA = "CBM-PE (Soldado)"
AULA = 14


@dataclass(frozen=True)
class Artefato:
    """Um artefato nomeado, com conteudo ja serializavel."""

    nome: str
    dados: Any
    #: Artefato local: nunca deve ser publicado nem importado.
    local: bool = False


def _alternativas_dict(q: Questao) -> dict[str, str]:
    return {a.letra: a.texto for a in q.alternativas}


def _links(q: Questao) -> dict[str, None]:
    """Sem URL no PDF, sem URL no artefato.

    Inventar ``links.teoria`` apontando para uma aula imaginaria seria pior que
    deixar vazio: a UI passaria a confiar num campo fabricado.
    """
    return {"teoria": None, "questao": None, "fonte_pdf": None}


def item_rico(q: Questao, canonica: str | None = None) -> dict[str, Any]:
    """Representacao completa para UI/revisao: sem PII, sem comentario."""
    gabarito = q.resolucao.gabarito if q.resolucao else None
    return {
        "id_local": q.id_local,
        "codigo": q.id_local,
        "aula": AULA,
        "secao": q.secao.numero,
        "secao_tipo": q.secao.tipo,
        "secao_rotulo": q.secao.rotulo,
        "grupo": q.grupo,
        "numero_na_secao": q.numero,
        "numero_original": q.numero_original,
        "tema": q.secao.tema,
        "assunto": q.secao.tema,
        "disciplina": DISCIPLINA,
        "alvo_apostila": ALVO_APOSTILA,
        "banca": q.tag.banca,
        "orgao": q.tag.orgao,
        "cargo": q.tag.cargo,
        "ano": q.tag.ano,
        "classificacao_tag": q.tag.classificacao,
        "notas_da_tag": list(q.tag.notas),
        "nivel": None,
        "tipo": q.tipo,
        "enunciado": q.enunciado,
        "alternativas": _alternativas_dict(q),
        "gabarito": gabarito,
        "gabarito_original": q.resolucao.original if q.resolucao else None,
        "gabarito_metodo": q.resolucao.metodo if q.resolucao else None,
        "origem_gabarito": q.origem_gabarito,
        "doador_gabarito": q.doador_gabarito,
        "pagina_pdf": q.pagina_inicial,
        "page_refs": [q.pagina_inicial, q.pagina_final],
        "content_hash": content_hash_from_import_row(
            q.enunciado, q.mapa_alternativas, gabarito or ""
        ),
        "body_hash": body_hash(q.enunciado, q.mapa_alternativas),
        "duplicata_de": canonica,
        "proveniencia": proveniencia_dict(q),
        "provenance_status": proveniencia_de(q),
        "quarantined": bool(q.problemas),
        "status": "em_revisao",
        "origin": "import",
        "resolucao_status": "pendente_geracao",
        "isPublic": False,
        "explicacao": None,
        "links": _links(q),
        "avisos": list(q.problemas),
    }


def linha_import(q: Questao) -> dict[str, Any]:
    """Linha no formato aceito pelo QuestionImportService.

    ``gabarito_importavel`` recusa palavra por extenso contra a replica do
    ``normalizeGabarito`` do importador, entao uma regressao aqui derruba a
    geracao em vez de importar resposta errada.
    """
    gabarito = gabarito_importavel(q.resolucao.gabarito if q.resolucao else None)
    row: dict[str, Any] = import_row_fields(q.enunciado, q.mapa_alternativas, gabarito)
    row["topic"] = q.secao.tema
    if q.tag.banca:
        row["banca"] = q.tag.banca
    if q.tag.cargo:
        row["cargo"] = q.tag.cargo
    if q.tag.ano is not None:
        row["ano"] = str(q.tag.ano)
    #: ``orgao`` nao tem coluna no importador; vai para ``fonte`` sem inventar.
    origem = " / ".join(x for x in (q.tag.orgao, ALVO_APOSTILA) if x)
    if origem:
        row["fonte"] = origem
    return row


def linha_import_certo_errado(q: Questao) -> dict[str, Any]:
    """Item C/E com alternativas sinteticas: ``alternativa_c: Certo`` / ``e: Errado``.

    Esse par e o que faz ``validateQuestion`` aceitar o item (o gabarito
    precisa corresponder a uma alternativa existente) e o que impede o
    ``normalizeGabarito`` de transformar "Correto." em "E".
    """
    row = linha_import(q)
    row["alternativa_c"] = CERTO_ERADO_ALTERNATIVAS["C"]
    row["alternativa_e"] = CERTO_ERADO_ALTERNATIVAS["E"]
    return row


def comentario_local(q: Questao) -> dict[str, Any]:
    """Unidade do arquivo LOCAL: comentario do compilador, nunca publicado."""
    return {
        "id_local": q.id_local,
        "secao": q.secao.numero,
        "grupo": q.grupo,
        "numero_original": q.numero_original,
        "pagina_pdf": q.pagina_inicial,
        "comentario": " ".join(q.comentario).strip(),
    }


def quarentena(q: Questao) -> dict[str, Any]:
    """Registro de quarentena: motivo e ponteiro, sem texto de terceiros."""
    return {
        "id_local": q.id_local,
        "secao": q.secao.numero,
        "grupo": q.grupo,
        "numero_original": q.numero_original,
        "pagina_pdf": q.pagina_inicial,
        "motivos": list(q.problemas),
        "procedencia": proveniencia_de(q),
        "gabarito": q.resolucao.gabarito if q.resolucao else None,
        "gabarito_candidatos": (
            list(q.resolucao.candidatos) if q.resolucao else []
        ),
        "gabarito_bruto": q.resolucao.original if q.resolucao else None,
    }


def contagens(questoes: list[Questao]) -> dict[str, Any]:
    """Totais do relatorio, todos recalculaveis a partir do PDF."""
    por_tipo: dict[str, int] = {}
    for q in questoes:
        por_tipo[q.tipo] = por_tipo.get(q.tipo, 0) + 1
    por_origem: dict[str, int] = {}
    por_origem_com_letra: dict[str, int] = {}
    for q in questoes:
        por_origem[q.origem_gabarito] = por_origem.get(q.origem_gabarito, 0) + 1
        if q.resolucao and q.resolucao.gabarito:
            por_origem_com_letra[q.origem_gabarito] = (
                por_origem_com_letra.get(q.origem_gabarito, 0) + 1
            )
    return {
        "total_itens": len(questoes),
        "por_tipo": dict(sorted(por_tipo.items())),
        #: De onde veio a *tentativa* de veredicto, inclusive quando o PDF diz
        #: ANULADA ou não entrega letra: a soma é ``total_itens``, não
        #: ``com_gabarito``. Já foi rotulado como se fosse a segunda coisa.
        "por_origem_veredicto": dict(sorted(por_origem.items())),
        #: Só os itens que terminam com letra A-E. A soma DEVE bater com
        #: ``com_gabarito``; ``verificar`` confere isso em disco.
        "com_gabarito_por_origem": dict(sorted(por_origem_com_letra.items())),
        "com_gabarito": sum(1 for q in questoes if q.resolucao and q.resolucao.gabarito),
        "sem_gabarito": sum(1 for q in questoes if not (q.resolucao and q.resolucao.gabarito)),
        "quarentena": sum(1 for q in questoes if q.problemas),
        "ineditas": sum(1 for q in questoes if q.inedita),
        "anuladas": sum(1 for q in questoes if q.resolucao and q.resolucao.anulada),
        "conflitos": sum(1 for q in questoes if q.resolucao and q.resolucao.conflitado),
        "recuperadas_por_corpo": sum(1 for q in questoes if q.doador_gabarito),
    }
