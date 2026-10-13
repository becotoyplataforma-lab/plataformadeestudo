# -*- coding: utf-8 -*-
"""Reconstrucao e leitura das tags de prova ``(BANCA / CARGO / ANO)``.

Formas medidas no PDF (nao supostas):

* ``1. (INOVERSASUL / PROFESSOR / 2025)`` -- parenteses, 3 segmentos
* ``47. Prefeitura de Espera Feliz - MG / 2024`` -- sem parenteses, 2 segmentos
* ``3. (TRT - 15ª Região - SP / 2025) - Utilize o texto da questão anterior``
* ``46.(QUESTÃO INÉDITA / ESTRATÉGIA CONCURSOS / 2021)`` -- autoria do compilador
* ``24.(CISPAR / LABORATÓRIO / 2020) - Adaptada``
* tag quebrada em duas linhas (``... /`` + ``09.2025. Adaptado)``), vistas nas
  secoes 20, 28 e 31.

Principio: **nenhum papel adivinhado**. A contagem que define o papel e a dos
segmentos ANTES de remover o ano (3 = banca/cargo/ano; 2 = orgao/ano, com
banca ``None`` porque o material nao informa). E questao inedita nao ganha
banca nem orgao: o texto da tag contem a marca do compilador, e marca nao vai
para artefato publico.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_ANCORA = re.compile(r"^(\d{1,3})\.\s*(.*)$")
_PARENTASES = re.compile(r"^\((?P<tag>.*?)\)\s*(?P<cauda>.*)$", re.DOTALL)
_ANO = re.compile(r"^(?:.*?(?:^|\D))?(19\d{2}|20\d{2})(?:\D|$)")
_ULTIMO_ANO = re.compile(r"(?<!\d)(19\d{2}|20\d{2})(?!\d)")
_NOTA = re.compile(
    r"[\u2013-]\s*(adaptad[ao]\s+com\s+adapta[c\u00e7][\u00e3o]es|adaptad[ao]"
    r"|com\s+adapta[c\u00e7][\u00f5e]es|utilize\s+o\s+texto[^)]*"
    r"|quest\u00e3o\s+in\u00e9dita)[^)]*$",
    re.IGNORECASE,
)
_INEDITA = re.compile(r"quest\u00e3o\s+in\u00e9dita", re.IGNORECASE)
_MARCA = re.compile(r"estrategia\s*concursos|estrategiaconcursos", re.IGNORECASE)
#: Linha que abre uma nova questao: numero + tag (com ou sem parenteses).
_PROXIMA_ANCORA = re.compile(r"^\d{1,3}\.\s*(\(.*\)|\D*\s/\s.*)$")

#: Papel dos segmentos, pela contagem ORIGINAL (ano ainda incluido).
PAPEIS: dict[int, tuple[str, ...]] = {
    3: ("banca", "cargo", "ano"),
    2: ("orgao", "ano"),
    1: ("orgao",),
}


@dataclass(frozen=True)
class Tag:
    """Tag reconstruida, com papel duvidoso rotulado em vez de chute."""

    crua: str
    classificacao: str
    banca: str | None = None
    orgao: str | None = None
    cargo: str | None = None
    ano: int | None = None
    notas: tuple[str, ...] = ()
    inedita: bool = False

    def como_dict(self) -> dict[str, object]:
        return {
            "tag_crua": self.crua,
            "classificacao_tag": self.classificacao,
            "banca": self.banca,
            "orgao": self.orgao,
            "cargo": self.cargo,
            "ano": self.ano,
            "notas": list(self.notas),
            "inedita": self.inedita,
        }


def _sem_marca(texto: str) -> str:
    """Remove a marca do compilador de todo campo destinado a artefato."""
    return _MARCA.sub("[compilador]", texto).strip()


def desfazer_fragmentacao(linhas: list[tuple[int, str]]) -> list[tuple[int, str]]:
    """Recolhe tags quebradas entre linhas (ate 3 linhas a frente).

    Gatilhos medidos: parenteses aberto sem fechamento, ou linha terminando
    em ``/``, ``-`` ou ``\u2013``.

    Nunca engole uma ancora: absorver a linha ``33. (BANCA / ANO)`` dentro da
    linha anterior destruiria a questao 33 e, com o walk sequencial, todo o
    resto da secao junto.
    """
    saida: list[tuple[int, str]] = []
    i = 0
    while i < len(linhas):
        pagina, linha = linhas[i]
        j = i + 1
        while j < len(linhas) and j - i <= 3:
            aberto = linha.count("(") - linha.count(")")
            pendurada = linha.rstrip().endswith(("/", "-", "\u2013"))
            if aberto <= 0 and not pendurada:
                break
            if _PROXIMA_ANCORA.match(linhas[j][1].strip()):
                break
            linha = f"{linha.rstrip()} {linhas[j][1].strip()}".strip()
            j += 1
        saida.append((pagina, linha))
        i = j
    return saida


def extrair_ano(valor: str) -> tuple[int | None, str | None]:
    """Separa o ano do resto de um segmento de tag.

    Exige **um unico** ano no segmento: "2020 e 2022" ou "TRT 15 2024" nao
    permitem afirmar qual e o ano da prova, e nesse caso nada e extraido.
    O sobra (ex.: ``09. Adaptado`` de ``09.2025. Adaptado``) e devolvida para
    virar nota revisavel, nao lixo silencioso.
    """
    anos = _ULTIMO_ANO.findall(valor)
    if len(anos) != 1:
        return None, valor.strip(" -\u2013.") or None
    m = _ULTIMO_ANO.search(valor)
    if not m:
        return None, valor.strip(" -\u2013.") or None
    sobra = (valor[: m.start() ] + " " + valor[m.end() :]).strip(" .-\u2013")
    return int(m.group(1)), sobra or None


def numero_de_ancora(linha: str) -> tuple[int, str] | None:
    """Retorna ``(numero, corpo)`` se a linha tem forma de ancora de questao.

    Exige numero + tag (entre parenteses ou com `` / ``) e rejeita linha de
    gabarito de lista. Nao decide monotonia: isso e do walk.
    """
    m = _ANCORA.match(linha.strip())
    if not m:
        return None
    corpo = m.group(2).strip()
    if not corpo or eh_linha_de_chave(corpo):
        return None
    if not (corpo.startswith("(") or " / " in corpo):
        return None
    return int(m.group(1)), corpo


def interpretar_tag(corpo: str) -> Tag:
    """Interpreta o corpo de uma ancora, com ou sem parenteses."""
    texto = corpo.strip()
    notas: list[str] = []

    cauda = ""
    dentro = _PARENTASES.match(texto)
    if dentro:
        bruta, cauda = dentro.group("tag"), dentro.group("cauda").strip()
    else:
        bruta = texto.rstrip(") ").strip()

    for origem in (cauda, bruta):
        nota = _NOTA.search(origem)
        if nota:
            notas.append(_sem_marca(nota.group(0).lstrip("\u2013- ").rstrip(")")).strip())

    inedita = bool(_INEDITA.search(bruta)) or bool(_INEDITA.search(cauda))
    if inedita:
        notas.append("questao inedita do compilador")

    #: Segmentos originais, com o ano ainda dentro de um deles. O papel e
    #: atribuido por posicao sobre essa lista: 3 = banca/cargo/ano,
    #: 2 = orgao/ano. Contar depois de extrair o ano inverteria o papel de
    #: "INOVERSASUL", e o ano pode vir embutido ("09.2025. Adaptado").
    segmentos = [s.strip() for s in bruta.split("/") if s.strip()]
    ano: int | None = None
    if inedita:
        #: Marca nao vai a lugar nenhum: campos nomeados ficam vazios.
        for valor in segmentos:
            m = _ULTIMO_ANO.search(valor)
            if m and len(_ULTIMO_ANO.findall(valor)) == 1:
                ano = int(m.group(1))
                break
        return Tag(
            crua="QUESTÃO INÉDITA",
            classificacao="inedita",
            ano=ano,
            notas=tuple(dict.fromkeys(notas)),
            inedita=True,
        )

    papeis = PAPEIS.get(len(segmentos))
    campos: dict[str, str | None] = {"banca": None, "orgao": None, "cargo": None}
    if papeis:
        for papel, valor in zip(papeis, segmentos):
            if papel == "ano":
                achado, sobra = extrair_ano(valor)
                if achado is not None:
                    ano = achado
                if sobra:
                    notas.append(sobra)
            else:
                campos[papel] = _sem_marca(valor) or None
        classificacao = {3: "banca/cargo/ano", 2: "orgao/ano", 1: "orgao"}[len(segmentos)]
    else:
        #: 4+ segmentos: ordem nao estabelecida. O ano ainda e extraido se for
        #: unico, mas os campos nomeados ficam vazios em vez de receber chute.
        restantes: list[str] = []
        for valor in segmentos:
            achado, sobra = extrair_ano(valor)
            if achado is not None and ano is None:
                ano = achado
            if sobra:
                restantes.append(sobra)
        campos["orgao"] = _sem_marca(" / ".join(restantes)) or None if restantes else None
        classificacao = "indefinida"

    if ano is None:
        classificacao += "_sem_ano"

    return Tag(
        crua=_sem_marca(texto),
        classificacao=classificacao,
        banca=campos["banca"],
        orgao=campos["orgao"],
        cargo=campos["cargo"],
        ano=ano,
        notas=tuple(dict.fromkeys(notas)),
        inedita=inedita,
    )


def interpretar_ancora(ancora: str) -> Tag | None:
    """Interpreta uma linha inteira de ancora; ``None`` se nao for ancora."""
    m = _ANCORA.match(ancora.strip())
    if not m:
        return None
    corpo = m.group(2).strip()
    return interpretar_tag(corpo) if corpo else None


def eh_linha_de_chave(corpo: str) -> bool:
    """Reconhece linha de gabarito de lista: ``LETRA D`` / ``CORRETA`` etc."""
    return bool(
        re.match(
            r"^(?:LETRA\s*[A-E]\b|CERT[OA]|ERRAD[AO]|CORRET[OA]|INCORRET[OA]|"
            r"VERDADEIR[OA]|FALS[OA]|ANULAD[AO])\b",
            corpo.strip(),
            re.IGNORECASE,
        )
    )


def eh_ancora_de_questao(linha: str, esperada: int) -> bool:
    """Decide se a linha abre a questao ``esperada`` da secao.

    A exigencia de sequencia (o numero tem de ser exatamente o proximo) e o
    que impede um ``1. Com os prefixos Recem...`` de comentario, ou um
    ``12. LETRA B`` de gabarito, virarem questao. Somam-se a isso os dois
    formatos medidos de tag: entre parenteses, ou com `` / `` no corpo.
    """
    m = _ANCORA.match(linha.strip())
    if not m or int(m.group(1)) != esperada:
        return False
    corpo = m.group(2).strip()
    if not corpo or eh_linha_de_chave(corpo):
        return False
    return corpo.startswith("(") or " / " in corpo
