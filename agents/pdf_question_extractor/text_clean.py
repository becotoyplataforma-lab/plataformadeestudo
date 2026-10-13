# -*- coding: utf-8 -*-
"""Leitura do PDF e remocao estrutural de mobilia e PII do comprador.

A mobilia nao e uma lista fixa: ela e **detectada** pelas posicoes de topo e
rodape de cada pagina e pela cobertura (quantas paginas a contem). Isso tem
tres consequencias importantes:

* a linha ``CPF - nome do comprador`` sai do fluxo sem que o nome dela seja
  escrito em codigo-fonte, que e a condicao para isso virar repositorio;
* as strings removidas viram ``proibidas`` e sao devolvidas para a varredura
  de redacao, que aborta se qualquer uma reaparecer num artefato;
* se o material trocar de rodape, a deteccao acompanha; um catalogo fixo
  apenas vazaria em silencio.

O cache em JSON so guarda linhas ja limpas, para que iterar no parser nao
releia 862 paginas a cada execucao.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

#: Cobertura minima de paginas (nas zonas de topo/rodape) para ser mobilia.
COBERTURA_MINIMA = 0.85
TOPO = 4
RODAPE = 8

#: Rotulos que pertencem ao corpo da questao e jamais sao mobilia, por
#: frequencia alta que tenham (``Comentarios:`` aparece em 675 paginas).
_ROTULOS_CONTEUDO = re.compile(
    r"^(coment[áa]ri[oa]s?|gabarito|julgue|assinale|quest[ãa]o|"
    r"correto|errado|certo|incorreto|anulada|letra)\b",
    re.IGNORECASE,
)

#: Cabecalho de secao: ``QUESTOES COMENTADAS - ORTOGRAFIA``.
TITULO_SECAO = re.compile(
    r"^(QUEST\u00c3ES COMENTADAS|LISTA DE QUEST\u00d5ES)\s*[-\u2013]\s*(.+)$",
    re.IGNORECASE,
)
#: Linha de PII estrutural: 11 digitos + hifen + nome.
LINHA_PII = re.compile(r"^\d{11}\s*[-\u2013]\s*\S")
#: Linha so com numero de pagina (ou total de paginas).
NUMERO_DE_PAGINA = re.compile(r"^\d{1,4}$")
#: Marca d'agua tipo ``==b9955==``.
MARCA_AGUA = re.compile(r"^={2,}\s*[0-9a-fA-F]{4,8}\s*={2,}$")


@dataclass
class Paginas:
    """Linhas limpas por pagina, com o que foi removido documentado."""

    #: ``linhas[i]`` = linhas nao vazias da pagina i+1 do PDF, sem mobilia.
    linhas: list[list[str]]
    #: Mobilia detectada -> numero de paginas que a contem.
    mobilia: dict[str, int] = field(default_factory=dict)
    removidas: Counter = field(default_factory=Counter)
    #: Strings proibidas em artefato (identidade exata do que saiu).
    proibidas: frozenset[str] = frozenset()
    origem: str = ""
    origem_bytes: int = 0

    @property
    def total_paginas(self) -> int:
        return len(self.linhas)

    def serializar(self, caminho: Path) -> None:
        caminho.parent.mkdir(parents=True, exist_ok=True)
        caminho.write_text(
            json.dumps(
                {
                    "origem": self.origem,
                    "origem_bytes": self.origem_bytes,
                    "mobilia": self.mobilia,
                    "removidas": dict(self.removidas),
                    "linhas": self.linhas,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

    @classmethod
    def de_cache(cls, caminho: Path) -> "Paginas":
        dados = json.loads(caminho.read_text(encoding="utf-8"))
        mobilia = dados.get("mobilia", {})
        return cls(
            linhas=dados["linhas"],
            mobilia=mobilia,
            removidas=Counter(dados.get("removidas", {})),
            proibidas=frozenset(
                ln for ln in mobilia if not NUMERO_DE_PAGINA.match(ln)
            ),
            origem=dados.get("origem", ""),
            origem_bytes=dados.get("origem_bytes", 0),
        )


def _dividir(texto_da_pagina: str) -> list[str]:
    """Normaliza quebras do PDF e devolve apenas linhas com conteudo."""
    linhas = texto_da_pagina.replace("\r\n", "\n").split("\n")
    return [ln.strip() for ln in linhas if ln.strip()]


def ler_brutos(pdf_path: Path) -> list[str]:
    """Extrai o texto bruto de cada pagina com pypdfium2."""
    import pypdfium2

    doc = pypdfium2.PdfDocument(str(pdf_path))
    try:
        return [doc[i].get_textpage().get_text_bounded() for i in range(len(doc))]
    finally:
        doc.close()


def detectar_mobilia(brutos: list[str]) -> dict[str, int]:
    """Conta, por linha, em quantas paginas ela aparece no topo ou no rodape."""
    total = len(brutos)
    if not total:
        return {}
    cobertura: Counter = Counter()
    for bruto in brutos:
        linhas = _dividir(bruto)
        if not linhas:
            continue
        zonas = set(linhas[:TOPO]) | set(linhas[-RODAPE:])
        for ln in zonas:
            if _ROTULOS_CONTEUDO.match(ln):
                continue
            cobertura[ln] += 1
    minimo = COBERTURA_MINIMA * total
    return {ln: n for ln, n in cobertura.items() if n >= minimo}


def limpar(brutos: list[str]) -> tuple[list[list[str]], dict[str, int], Counter]:
    """Remove mobilia detectada + padroes estruturais de PII/pagina/marca."""
    mobilia = detectar_mobilia(brutos)
    removidas: Counter = Counter()
    paginas: list[list[str]] = []
    for bruto in brutos:
        conservadas: list[str] = []
        for ln in _dividir(bruto):
            if ln in mobilia:
                removidas["mobilia"] += 1
                continue
            if LINHA_PII.match(ln):
                removidas["pii_estrutural"] += 1
                continue
            if NUMERO_DE_PAGINA.match(ln):
                removidas["numero_de_pagina"] += 1
                continue
            if MARCA_AGUA.match(ln):
                removidas["marca_agua"] += 1
                continue
            conservadas.append(ln)
        paginas.append(conservadas)
    return paginas, mobilia, removidas


def carregar(pdf_path: Path, cache_path: Path | None = None) -> Paginas:
    """Le o PDF (ou o cache valido) e devolve paginas limpas.

    O cache e invalidado pelo caminho e pelo tamanho do arquivo: trocar o PDF
    nao deixa linhas velhas sobreviverem em silencio.
    """
    stat = pdf_path.stat()
    if cache_path and cache_path.exists():
        em_cache = Paginas.de_cache(cache_path)
        if em_cache.origem == str(pdf_path) and em_cache.origem_bytes == stat.st_size:
            return em_cache
    linhas, mobilia, removidas = limpar(ler_brutos(pdf_path))
    paginas = Paginas(
        linhas=linhas,
        mobilia=mobilia,
        removidas=removidas,
        #: Proibidas = mobilia textual. Inteiro puro ("862", o total de
        #: paginas) NAO entra: bloquear por identidade uma sequencia numerica
        #: reprova o proprio numero de pagina de cada questao, e portao que
        #: barra conteudo legitimo acaba sendo desligado.
        proibidas=frozenset(ln for ln in mobilia if not NUMERO_DE_PAGINA.match(ln)),
        origem=str(pdf_path),
        origem_bytes=stat.st_size,
    )
    if cache_path:
        paginas.serializar(cache_path)
    return paginas
