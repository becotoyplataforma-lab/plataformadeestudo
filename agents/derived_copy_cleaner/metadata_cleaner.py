"""Fachada de limpeza de registro interno (metadados) de copias derivadas.

Arquitetura atual
-----------------
- ``policy.py``: unica fonte de verdade das decisoes (duas politicas).
- ``pdf_engine.py``: unico modulo que toca bytes de PDF (pikepdf), com
  neutralizacao de conteudo ativo, validacao fail-closed da camada visual
  e ``RelatorioSanitizacao``.
- este modulo: fachada estavel para os chamadores antigos.

``limpar_metadados_pdf(bytes) -> bytes`` continua disponivel. A API nova e
``sanitizar_pdf_com_relatorio(bytes) -> (bytes, dict)``.

Nota de politica: desde a decisao de 2026-10-11 a sanitizacao e **completa**
``author``, ``creator``, ``producer``, ``owner``, ``origem``, ``source`` e
``origin`` saem da copia derivada intermediaria para que o operador reinsira
os metadados consolidados. ``CHAVES_PRESERVADAS`` esta vazio de proposito: a
preservacao migrou das chaves de metadado para a camada visual da pagina. A
politica conservadora anterior permanece enderecavel pelo nome
``regra_por_valor_conservadora``.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional, Tuple, Union

from . import policy
from .pdf_engine import (
    ErroSanitizacaoPdf,
    PdfAssinadoBloqueado,
    PdfCriptografadoBloqueado,
    PdfMalformadoBloqueado,
    RelatorioSanitizacao,
    ValidacaoSaidaBloqueada,
    sanitizar_pdf,
)
from .policy import (
    CHAVES_AUTORIA_LEGADA,
    CHAVES_IDENTIFICACAO_LEGADA,
    CHAVES_LEGADAS_REMOVIDAS,
    CHAVES_MARCA_DAGUA,
    CHAVES_PROIBIDAS,
    CHAVES_TECNICAS_PROIBIDAS,
    POLITICA_COMPLETA,
    POLITICA_CONSERVADORA,
    normalizar_chave,
)

__all__ = [
    "CHAVES_AUTORIA_LEGADA",
    "CHAVES_IDENTIFICACAO_LEGADA",
    "CHAVES_LEGADAS_REMOVIDAS",
    "CHAVES_MARCA_DAGUA",
    "CHAVES_PRESERVADAS",
    "CHAVES_PROIBIDAS",
    "CHAVES_TECNICAS_PROIBIDAS",
    "ErroSanitizacaoPdf",
    "PdfAssinadoBloqueado",
    "PdfCriptografadoBloqueado",
    "PdfMalformadoBloqueado",
    "POLITICA_COMPLETA",
    "POLITICA_CONSERVADORA",
    "RelatorioSanitizacao",
    "ValidacaoSaidaBloqueada",
    "chaves_proibidas_presentes",
    "limpar_metadados",
    "limpar_metadados_pdf",
    "normalizar_chave",
    "politica_vigente",
    "remover_chaves",
    "resumo_politica",
    "sanitizar_pdf",
    "sanitizar_pdf_com_relatorio",
    "_limpar_info_pdf",
]

#: Vazio na politica completa: nada de metadado e preservado, apenas a
#: camada visual e intocavel.
CHAVES_PRESERVADAS: Tuple[str, ...] = policy.CHAVES_PRESERVADAS


def politica_vigente() -> str:
    """Nome da politica ativa do pacote."""
    return policy.POLITICA_ATIVA


def _normalizar(chave: Any) -> str:
    """Normaliza uma chave para comparacao (heranca da API antiga)."""
    return policy.normalizar_chave(chave)


def chaves_proibidas_presentes(
    metadados: Dict[str, Any],
    politica: Optional[str] = None,
) -> List[str]:
    """Chaves removiveis presentes em ``metadados`` sob a politica dada."""
    return policy.chaves_proibidas_presentes(metadados, politica)


def limpar_metadados(
    metadados: Dict[str, Any],
    politica: Optional[str] = None,
) -> Dict[str, Any]:
    """Aplicar a politica a um dicionario de metadados e devolver o resultado.

    Na ``POLITICA_COMPLETA`` todo registro legado sai (tecnicos,
    marca-d'agua, autoria/origem e identificacao). Na
    ``POLITICA_CONSERVADORA`` somente os campos tecnicos saem e a
    marca-d'agua depende do valor.
    """
    limpos, _removidas, _registro = policy.separar_metadados(metadados, politica)
    return limpos


def detalhar_limpeza_metadados(
    metadados: Dict[str, Any],
    politica: Optional[str] = None,
) -> Dict[str, Any]:
    """Versao com auditoria: ``{limpos, removidos, registro}``."""
    limpos, removidas, registro = policy.separar_metadados(metadados, politica)
    return {"limpos": limpos, "removidos": removidas, "registro": registro}


def _limpar_info_pdf(
    info: Dict[str, Any],
    politica: Optional[str] = None,
) -> Dict[str, Any]:
    """Filtrar um dicionario ``/Info`` (chaves com ou sem barra inicial)."""
    limpo: Dict[str, Any] = {}
    for chave, valor in info.items():
        decisao, _motivo = policy.decisao_para_chave(chave, valor, politica)
        if decisao == policy.REMOVER:
            continue
        limpo[chave] = valor
    return limpo


def sanitizar_pdf_com_relatorio(
    pdf: Union[bytes, bytearray],
    config: Optional[Dict[str, Any]] = None,
    *,
    politica: Optional[str] = None,
) -> Tuple[bytes, Dict[str, Any]]:
    """Sanear um PDF e devolver ``(bytes, relatorio_serializavel)``.

    Aborta com subclass de ``ValueError`` para PDF criptografado, assinado
    ou malformado, e se a camada visual da saida nao for idempotente.
    """
    saida, relatorio = sanitizar_pdf(pdf, config, politica=politica)
    return saida, relatorio.to_dict()


def limpar_metadados_pdf(
    pdf: Union[bytes, bytearray],
    config: Optional[Dict[str, Any]] = None,
    *,
    politica: Optional[str] = None,
) -> bytes:
    """Sanear os **bytes reais** de um PDF e devolver o novo conteudo.

    Mantem a assinatura da API antiga (``bytes -> bytes``); delega todo o
    trabalho ao motor pikepdf, que hoje tambem remove a autoria/procedencia
    legada e neutraliza conteudo ativo.
    """
    saida, _relatorio = sanitizar_pdf(pdf, config, politica=politica)
    return saida


def remover_chaves(metadados: Dict[str, Any], chaves: Iterable[str]) -> Dict[str, Any]:
    """Remover um conjunto arbitrario de chaves (comparacao normalizada)."""
    return policy.remover_chaves(metadados, chaves)


def resumo_politica(politica: Optional[str] = None) -> Dict[str, Any]:
    """Retrato serializavel da politica (README, relatorio e config)."""
    return policy.resumo_politica(politica)