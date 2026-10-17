"""Política de uso do ícone DeepSeek.

Regra central (item 4 do escopo):
- O ícone DeepSeek é usado APENAS como identificador da ferramenta.
- Nunca deve sugerir criação, autoria ou endosso pela DeepSeek.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict

# Identificador canônico da ferramenta associada ao ícone.
ICONE_FERRAMENTA = "deepseek"


@dataclass(frozen=True)
class IconClaims:
    """Claims que o ícone NUNCA pode afirmar.

    Todos os campos são sempre ``False`` por política.
    """

    authorship: bool = False
    endorsement: bool = False
    origin_of_content: bool = False

    def to_dict(self) -> Dict[str, bool]:
        """Retorna os claims como dicionário simples."""
        return asdict(self)


def claims_do_icone() -> Dict[str, bool]:
    """Retorna os claims obrigatórios do ícone.

    Sempre: ``{authorship: False, endorsement: False, origin_of_content: False}``.
    """
    return IconClaims().to_dict()


def icone_sugere_autoria(texto: str) -> bool:
    """Verifica se um texto sugere autoria/endosso indevido pela DeepSeek.

    Retorna ``True`` se encontrar termos que impliquem criação, autoria ou
    endosso — o que é proibido pela política.
    """
    if not texto:
        return False

    termos_proibidos = (
        "criado pela deepseek",
        "criado por deepseek",
        "autoria deepseek",
        "autoria da deepseek",
        "endossado pela deepseek",
        "endosso da deepseek",
        "made by deepseek",
        "authored by deepseek",
        "endorsed by deepseek",
    )
    texto_normalizado = texto.lower()
    return any(termo in texto_normalizado for termo in termos_proibidos)


def validar_uso_icone(texto: str) -> None:
    """Levanta ``ValueError`` se o texto violar a política do ícone."""
    if icone_sugere_autoria(texto):
        raise ValueError(
            "Uso indevido do ícone: o texto sugere autoria/endosso pela DeepSeek. "
            "O ícone deve ser usado apenas como identificador da ferramenta."
        )
