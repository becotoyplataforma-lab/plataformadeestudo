"""Remoção de sanitização e aplicação de marca.

Item 1 do escopo:
- Remover sanitização e aplicação de marca EXCLUSIVAMENTE em cópias derivadas.
- Nunca aplicar em originais — levantar ``ValueError`` se
  ``target != "copia_derivada"``.
"""

from __future__ import annotations

from typing import Any, Dict

# Único alvo permitido para qualquer operação de limpeza.
TARGET_PERMITIDO = "copia_derivada"


def validar_target(target: str) -> None:
    """Garante que a operação só ocorra em cópias derivadas.

    Levanta ``ValueError`` se ``target`` não for exatamente ``"copia_derivada"``.
    """
    if target != TARGET_PERMITIDO:
        raise ValueError(
            f"Operação permitida apenas em '{TARGET_PERMITIDO}'. "
            f"Recebido: '{target}'. Nunca aplicar em originais."
        )


def remover_sanitizacao_e_marca(
    documento: Dict[str, Any], target: str
) -> Dict[str, Any]:
    """Remove sanitização e marca de uma cópia derivada.

    Parâmetros
    ----------
    documento:
        Estrutura (dict) representando o documento. Pode conter as chaves
        ``sanitizado`` e ``marca`` que serão removidas/neutralizadas.
    target:
        Deve ser ``"copia_derivada"``; caso contrário, ``ValueError``.

    Retorna
    -------
    dict
        Cópia do documento sem sanitização e sem marca.
    """
    # 1. Escopo: nunca aplicar em originais.
    validar_target(target)

    # Trabalha sobre uma cópia para não mutar a entrada.
    limpo = dict(documento)

    # Remove flags de sanitização.
    limpo.pop("sanitizado", None)
    limpo.pop("sanitization", None)
    limpo.pop("sanitize", None)

    # Remove a marca aplicada.
    limpo.pop("marca", None)
    limpo.pop("brand", None)
    limpo.pop("branding", None)

    # Registra explicitamente que a sanitização/marca foram removidas.
    limpo["sanitizacao_removida"] = True
    limpo["marca_removida"] = True

    return limpo
