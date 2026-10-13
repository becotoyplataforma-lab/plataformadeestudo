# -*- coding: utf-8 -*-
"""Segmentacao do indice da apostila em 33 secoes.

O PDF numera as questoes a partir de 1 **dentro de cada secao**, entao o
numero da questao nao identifica nada sozinho: ``Questao 1`` existe 33 vezes.
Todo identificador gerado e escopado por secao (``A14-S01-001``).

O indice traz o numero da pagina impressa, e neste PDF a pagina impressa e a
pagina do arquivo (1-based): a secao 1 comeca na pagina 4 e o texto dela esta
de fato no indice 3 de ``pypdfium2``. ``pagina_final`` e derivada do inicio da
secao seguinte, e a ultima secao fecha no fim do documento.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

#: ``1) Questoes Comentadas - Ortografia 4`` com lider de pontos antes.
LINHA_INDICE = re.compile(
    r"(\d{1,2})\)\s*(Quest\u00f5es Comentadas|Lista de Quest\u00f5es)"
    r"\s*[-\u2013]\s*(.+?)\s+(\d{1,4})\s*$"
)

TIPOS = {"quest\u00f5es comentadas": "comentada", "lista de quest\u00f5es": "lista"}


@dataclass(frozen=True)
class Secao:
    """Uma secao do indice, com faixa de paginas ja resolvida."""

    numero: int
    tipo: str  # "comentada" | "lista"
    tema: str
    pagina_inicial: int
    pagina_final: int

    @property
    def id_prefixo(self) -> str:
        return "S%02d" % self.numero

    @property
    def rotulo(self) -> str:
        return ("Questões Comentadas" if self.tipo == "comentada" else "Lista de Questões") + (
            " - " + self.tema
        )

    def range_indice(self) -> range:
        """Indices 0-based de ``Paginas.linhas`` cobertos pela secao."""
        return range(self.pagina_inicial - 1, self.pagina_final)


def parsear_indice(
    paginas: list[list[str]], max_paginas_de_leitura: int = 6
) -> list[Secao]:
    """Extrai as secoes do indice e resolve as faixas de paginas.

    Procura nas primeiras paginas em vez de fixar o indice 1/2: se a capa
    mudar de tamanho, a leitura continua achando as linhas do indice.
    """
    encontradas: dict[int, tuple[str, str, int]] = {}
    for pagina in paginas[:max_paginas_de_leitura]:
        for linha in pagina:
            m = LINHA_INDICE.search(linha)
            if not m:
                continue
            numero = int(m.group(1))
            tipo = TIPOS.get(m.group(2).lower().strip())
            if tipo is None:
                continue
            encontradas.setdefault(numero, (tipo, m.group(3).strip(), int(m.group(4))))

    if not encontradas:
        raise ValueError("indice nao encontrado nas primeiras paginas do PDF")

    numeros = sorted(encontradas)
    secoes: list[Secao] = []
    for pos, numero in enumerate(numeros):
        tipo, tema, inicio = encontradas[numero]
        fim = encontradas[numeros[pos + 1]][2] - 1 if pos + 1 < len(numeros) else 0
        secoes.append(Secao(numero, tipo, tema, inicio, fim))

    total = len(paginas)
    return [
        s if s.pagina_final else Secao(s.numero, s.tipo, s.tema, s.pagina_inicial, total)
        for s in secoes
    ]


def linhas_da_secao(paginas: list[list[str]], secao: Secao) -> list[tuple[int, str]]:
    """Achata as linhas da secao com a pagina de origem (1-based, real do PDF)."""
    saida: list[tuple[int, str]] = []
    for indice in secao.range_indice():
        if indice >= len(paginas):
            break
        for linha in paginas[indice]:
            saida.append((indice + 1, linha))
    return saida
