# -*- coding: utf-8 -*-
"""Extrator de questões da Aula 14 (CBM-PE / Língua Portuguesa).

Pipeline de proveniência: lê o PDF, remove mobília e PII do comprador,
segmenta as 33 seções do índice, reconhece âncoras de questão, resolve
gabarito e emite artefatos JSON em estado de revisão (nunca publicados).

Regra de ouro: nada é inventado. O que o PDF não diz entra como ``None``.
"""

__all__ = ["__version__"]

__version__ = "0.1.0"
