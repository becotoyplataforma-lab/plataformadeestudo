"""Pacote do agente ``derived_copy_cleaner``.

Este agente é responsável por limpar cópias derivadas de apostilas:
- Remove sanitização e aplicação de marca.
- Remove metadados TÉCNICOS (software, tool_chain, fingerprint, watermark),
  preservando autoria e procedência (author, creator, producer, owner,
  origem, source, origin) — ver docs/KNOWLEDGE_PIPELINE.md e AGENTS.md.
- Usa o ícone DeepSeek apenas como identificador da ferramenta.

IMPORTANTE: nunca deve ser aplicado em arquivos originais. Somente em
cópias derivadas (``target == "copia_derivada"``).
"""

from .agent import DerivedCopyCleaner, DerivedCopyError

__all__ = ["DerivedCopyCleaner", "DerivedCopyError"]
