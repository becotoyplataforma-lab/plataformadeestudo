"""Agente ``derived_copy_cleaner``.

Orquestra a limpeza de COPIAS DERIVADAS de apostilas:

1. Valida o escopo (somente ``target == "copia_derivada"``).
2. Remove sanitizacao e marca.
3. Expurga o registro interno legado conforme a politica ativa
   (``policy.POLITICA_COMPLETA`` por padrao): metadados tecnicos,
   marca-d'agua, autoria/origem/procedencia e identificacao.
4. Neutraliza conteudo ativo (/JavaScript, /JS, /AA, /OpenAction perigoso) e
   valida a camada visual, tudo no motor pikepdf (``pdf_engine``).
5. Aplica a politica do icone DeepSeek: o icone e apenas identificador da
   ferramenta. **Nenhuma marca visual e desenhada por padrao** -
   ``marca_deepseek.ativado`` esta como ``false`` em ``config.yaml``; quando
   ativado, o modo ``proveniencia`` escreve somente metadado additive depois
   da sanitizacao e nunca pinta por cima de carimbos de terceiros.

O que cada expurgo remove vai para ``ResultadoLimpeza.registro_removido`` /
``RelatorioSanitizacao.docinfo_removido``, o inventario que o operador usa
para a reinsercao consolidada de metadados.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from . import policy
from .icon_policy import claims_do_icone, validar_uso_icone
from .metadata_cleaner import (
    ErroSanitizacaoPdf,
    limpar_metadados_pdf,
    sanitizar_pdf_com_relatorio,
)
from .sanitizer_stripper import TARGET_PERMITIDO, remover_sanitizacao_e_marca, validar_target

__all__ = [
    "DerivedCopyCleaner",
    "DerivedCopyError",
    "ResultadoLimpeza",
    "ErroSanitizacaoPdf",
    "carregar_config",
    "limpar_copia_derivada",
]

_ARQUIVO_CONFIG = Path(__file__).with_name("config.yaml")
_CACHE_CONFIG: Optional[Dict[str, Any]] = None


class DerivedCopyError(ValueError):
    """Erro especifico do agente de limpeza de copias derivadas."""


def carregar_config(caminho: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
    """Ler ``config.yaml`` do pacote; qualquer falha devolve ``{}`` (default seguro)."""
    global _CACHE_CONFIG
    if caminho is None and _CACHE_CONFIG is not None:
        return _CACHE_CONFIG
    try:
        import yaml
    except Exception:
        return {}
    alvo = Path(caminho) if caminho is not None else _ARQUIVO_CONFIG
    try:
        dados = yaml.safe_load(alvo.read_text(encoding="utf-8")) or {}
    except Exception:
        dados = {}
    if not isinstance(dados, dict):
        dados = {}
    if caminho is None:
        _CACHE_CONFIG = dados
    return dados


@dataclass
class ResultadoLimpeza:
    """Resultado da execucao do agente."""

    target: str
    documento: Dict[str, Any]
    metadados_removidos: List[str] = field(default_factory=list)
    claims: Dict[str, bool] = field(default_factory=dict)
    metadados_preservados: List[str] = field(default_factory=list)
    registro_removido: List[Dict[str, str]] = field(default_factory=list)
    politica: str = policy.POLITICA_ATIVA
    marca_visual_aplicada: bool = False
    relatorio: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "target": self.target,
            "documento": self.documento,
            "metadados_removidos": self.metadados_removidos,
            "claims": self.claims,
            "metadados_preservados": self.metadados_preservados,
            "registro_removido": self.registro_removido,
            "politica": self.politica,
            "marca_visual_aplicada": self.marca_visual_aplicada,
            "relatorio": self.relatorio,
        }


class DerivedCopyCleaner:
    """Agente responsavel por limpar copias derivadas de apostilas."""

    def __init__(
        self,
        target: str = TARGET_PERMITIDO,
        config: Optional[Dict[str, Any]] = None,
        politica: Optional[str] = None,
    ) -> None:
        # 1. ESCOPO: valida imediatamente o alvo.
        validar_target(target)
        self.target = target
        self.config = carregar_config() if config is None else dict(config)
        alvo = politica if politica is not None else self.config.get("politica")
        self.politica = policy.normalizar_politica(alvo)
        self.ultimo_relatorio: Dict[str, Any] = {}

    # -- utilitario interno -------------------------------------------------
    def _revalidar_escopo(self) -> None:
        try:
            validar_target(self.target)
        except ValueError as exc:  # pragma: no cover - caminho defensivo
            raise DerivedCopyError(str(exc)) from exc

    # -- documento em memoria (dict) ---------------------------------------
    def limpar(self, documento: Dict[str, Any]) -> ResultadoLimpeza:
        """Executar a limpeza completa de uma copia derivada.

        Levanta ``DerivedCopyError`` (subclasse de ``ValueError``) se o alvo
        nao for uma copia derivada.
        """
        self._revalidar_escopo()

        # 2. Remove sanitizacao e marca.
        documento_limpo = remover_sanitizacao_e_marca(documento, self.target)

        # 3. Expurga o registro interno legado pela politica ativa.
        metadados = documento_limpo.get("metadados", {}) or {}
        limpos, removidos, registro = policy.separar_metadados(metadados, self.politica)
        documento_limpo["metadados"] = limpos

        # 4. Politica do icone: apenas identificador da ferramenta.
        texto_icone = documento_limpo.get("texto_icone", "")
        validar_uso_icone(texto_icone)

        marca = self.config.get("marca_deepseek", {}) or {}
        return ResultadoLimpeza(
            target=self.target,
            documento=documento_limpo,
            metadados_removidos=removidos,
            claims=claims_do_icone(),
            metadados_preservados=list(limpos.keys()),
            registro_removido=registro,
            politica=self.politica,
            marca_visual_aplicada=bool(marca.get("ativado", False))
            and marca.get("modo") == "visual",
        )

    # -- bytes reais de PDF -------------------------------------------------
    def limpar_pdf(self, pdf: Union[bytes, bytearray]) -> bytes:
        """Sanear os bytes reais de um PDF (API antiga: so devolve os bytes)."""
        self._revalidar_escopo()
        saida, relatorio = sanitizar_pdf_com_relatorio(
            pdf, self.config, politica=self.politica
        )
        self.ultimo_relatorio = relatorio
        return saida

    def sanitizar_pdf(self, pdf: Union[bytes, bytearray]) -> Dict[str, Any]:
        """Sanear um PDF e devolver ``{"pdf": bytes, "relatorio": dict}``.

        Caminho recomendado: expoe o relatorio de auditoria com o que saiu
        (para reinsercao consolidada) e com as checagens de integridade
        visual que a saida passou.
        """
        return {
            "pdf": self.limpar_pdf(pdf),
            "relatorio": dict(self.ultimo_relatorio),
        }


def limpar_copia_derivada(
    documento: Dict[str, Any],
    target: str = TARGET_PERMITIDO,
    politica: Optional[str] = None,
) -> Dict[str, Any]:
    """Funcao de conveniencia para limpar uma copia derivada.

    Levanta ``ValueError`` se ``target != "copia_derivada"``.
    """
    agente = DerivedCopyCleaner(target=target, politica=politica)
    return agente.limpar(documento).to_dict()