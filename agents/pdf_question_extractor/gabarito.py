# -*- coding: utf-8 -*-
"""Resolucao de gabarito e blindagem contra o ``normalizeGabarito`` do importador.

O importador aceita gabarito **somente como letra**. A funcao TS (linhas
142-151) faz ``value.toUpperCase().match(/[A-E]/g)`` e, quando ha mais de
uma letra distinta, devolve a **ultima**. Isso e inofensivo para ``"C"`` e
``"E"``, mas destruiu palavras por extenso. Comprovado por execucao contra
o TS real (tests/golden_hash.json):

    "Correto."    -> "E"   (gabarito invertido, silenciosamente)
    "Certo."      -> "E"   (idem)
    "Errado."     -> "D"   (letra que nem existe em item C/E)
    "Verdadeiro." -> "E"
    "Incorreto."  -> "E"

Por isso: itens Certo/Errado viram alternativas sinteticas ``C: "Certo"`` /
``E: "Errado"`` e ``gabarito`` guarda apenas ``"C"`` ou ``"E"``. A palavra
por extenso permanece em ``gabarito_original`` para revisao humana.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

#: Alternativas canonicas de item Certo/Errado (CESPE-style).
CERTO_ERADO_ALTERNATIVAS: dict[str, str] = {"C": "Certo", "E": "Errado"}

#: Palavras que aparecem no PDF -> letra. Formas feminis (CORRETA/INCORRETA)
#: sao as usadas nas chaves das listas; masculinas, nos comentarios.
_WORD_TO_LETTER: dict[str, str] = {
    "certo": "C",
    "correto": "C",
    "correta": "C",
    "verdadeiro": "C",
    "verdadeira": "C",
    "errado": "E",
    "incorreto": "E",
    "incorreta": "E",
    "falso": "E",
    "falsa": "E",
}

#: Linhas de gabarito que nao permitem importacao: questao sem resposta valida.
ANULADA = "ANULADA"

_LETRAS_VALIDAS = frozenset("ABCDE")
_LETRA_SOLTA = re.compile(r"^([A-E])\.?$", re.IGNORECASE)
_LETRA_COMPOSTA = re.compile(r"letra\s*\.?\s*([A-E])\b", re.IGNORECASE)
_AMBIGUA = re.compile(r"\b([A-E])\s*/\s*([A-E])\b", re.IGNORECASE)
_GABARITO_TRECHO = re.compile(r"gabarito\b[:\u2013\-]?\s*(.{0,48})", re.IGNORECASE)
#: So o rotulo, sem o valor: usar _GABARITO_TRECHO para limpar apagaria a
#: propria letra ("Gabarito: Letra C." viraria string vazia).
_ROTULO_GABARITO = re.compile(r"^\s*gabarito\b[:\u2013\-]?\s*", re.IGNORECASE)
_ANULADA = re.compile(r"\banulad[ao]\b", re.IGNORECASE)
#: Alternancia mais-longa-primeiro, para "verdadeira" nao ser comida por "verdadeiro".
_WORDS = "|".join(sorted(_WORD_TO_LETTER, key=len, reverse=True))
_PALAVRA_ISOLADA = re.compile(rf"^(?:[^\s]+\s+)?({_WORDS})\.?$", re.IGNORECASE)
#: Linhas de conclusao autonoma usadas pelo material: "Questao correta." etc.
#: Veredito que abre a linha do comentario: "Incorreto.", "Correto.", "Errado.".
_VEREDITO_INICIAL = re.compile(rf"^({_WORDS})\b[\s.,]", re.IGNORECASE)
_CONCLUSAO_ISOLADA = re.compile(
    rf"^(?:gabarito\s+)?(?:da\s+)?(?:questao|alternativa|item)\s+({_WORDS})\.?$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Resolution:
    """Resultado da resolucao de gabarito de um bloco."""

    gabarito: str | None
    metodo: str
    original: str | None = None
    candidatos: tuple[str, ...] = field(default_factory=tuple)
    conflitado: bool = False
    anulada: bool = False

    @property
    def resolvido(self) -> bool:
        return self.gabarito is not None and not self.conflitado and not self.anulada

    @property
    def motivo_quarentena(self) -> str | None:
        if self.anulada:
            return "gabarito_anulado"
        if self.conflitado:
            return "gabarito_conflitante"
        if self.gabarito is None:
            return "gabarito_ausente"
        return None


def palavra_para_letra(value: str) -> str | None:
    """Converte uma palavra de gabarito em letra C/E; None se nao for uma."""
    return _WORD_TO_LETTER.get(value.strip().rstrip(".").lower())


def normalizar_chave_lista(resto: str) -> Resolution:
    """Resolve uma linha de chave de lista (``LETRA D`` / ``CORRETA`` / ``B/E``).

    Os rotulos do material chegam acentuados ("Questao correta."), entao o
    casamento e feito sobre texto desacentado e o ``original`` preservado.
    """
    original = resto.strip()
    text = _sem_acentos(original).strip().strip(".").strip()
    if not text:
        return Resolution(None, "vazio")
    if _ANULADA.search(text):
        return Resolution(None, "anulada", original=original, anulada=True)
    amb = _AMBIGUA.search(text)
    if amb:
        return Resolution(
            None,
            "ambigua",
            original=original,
            candidatos=(amb.group(1).upper(), amb.group(2).upper()),
            conflitado=True,
        )
    letra = _LETRA_COMPOSTA.search(text) or _LETRA_SOLTA.match(text)
    if letra:
        return Resolution(letra.group(1).upper(), "letra", original=original)
    palavra = _PALAVRA_ISOLADA.match(text)
    if palavra:
        mapped = palavra_para_letra(palavra.group(1))
        if mapped:
            return Resolution(mapped, "palavra", original=original)
    return Resolution(None, "nao_reconhecido", original=original)

def _sem_acentos(texto: str) -> str:
    """Remove acentos no mesmo bloco U+0300-U+036F usado pelo hashing.

    As frases-rotina do material ("Questao correta.", "gabarito ...") chegam
    acentuadas, e os padroes de rotulo sao escritos sem acento.
    """
    return "".join(
        c
        for c in unicodedata.normalize("NFD", texto)
        if not ("\u0300" <= c <= "\u036f")
    )


def _primeira_frase(trecho: str) -> str:
    """Recorta ate o primeiro ponto-final, fora do miolo de abreviaturas."""
    trecho = trecho.strip()
    for i, ch in enumerate(trecho):
        if ch == "." and (i == len(trecho) - 1 or not trecho[i + 1 : i + 2].isdigit()):
            return trecho[: i + 1]
    return trecho


def separar_mencoes_de_gabarito(linha: str) -> tuple[str, list[str]]:
    """Extrai as menções de gabarito que estão dentro de uma linha de conteúdo.

    O material cola o veredito no fim de uma alternativa
    (``d) O homem dialogava COM a mulher. Gabarito letra B.``). Deixar isso no
    texto da alternativa equivaleria a importar a questão com a resposta dentro
    do enunciado; descartar a linha inteira perderia o gabarito. A separação
    manda a menção para a resolução e mantém o texto limpo.
    """
    mencoes: list[str] = []
    partes: list[str] = []
    restante = linha
    while True:
        m = re.search(r"gabarito\b", restante, re.IGNORECASE)
        if not m:
            partes.append(restante)
            break
        partes.append(restante[: m.start()].rstrip(" ,;"))
        trecho = restante[m.start() :]
        corte = re.search(r"\.\s+\S", trecho)
        if corte:
            mencoes.append(trecho[: corte.end() - 1].strip())
            restante = trecho[corte.end() - 1 :].strip()
        else:
            mencoes.append(trecho.strip())
            restante = ""
    texto = " ".join(p for p in partes if p).strip()
    return texto, mencoes


def emendar_mencoes(linhas: list[str]) -> list[str]:
    """Junta a mencoes truncada no fim da linha com a linha seguinte.

    Medido: ``... por isso e nosso gabarito. Gabarito`` com o ``letra E.`` na
    linha de baixo. Sem emenda, a questao parece nao ter gabarito.
    """
    saida: list[str] = []
    i = 0
    while i < len(linhas):
        ln = linhas[i]
        if re.search(r"gabarito\s*[:\u2013\-]?\s*$", ln, re.IGNORECASE) and i + 1 < len(linhas):
            saida.append(f"{ln.rstrip()} {linhas[i + 1].strip()}")
            i += 2
            continue
        saida.append(ln)
        i += 1
    return saida


def resolver_de_blocos(linhas: list[str], comentario: list[str] | None = None) -> Resolution:
    """Resolve o gabarito a partir de um bloco bruto (comentarios inclusive).

    Quatro formas medidas no PDF, em ordem de confianca:

    1. ``Gabarito: Letra C.`` e ``Gabarito Letra D.`` (sem dois-pontos e a
       maioria: 191 contra 60);
    2. veredito colado no fim do comentario (``... Gabarito: Errado.``);
    3. frase de conclusao autonoma (``Questao incorreta.``);
    4. veredito abrindo a linha do comentario (``Incorreto. "grande
       reportagem" = ...``) -- esta so vale dentro dos comentarios, porque um
       enunciado que comece com "Certo," nao e uma resposta.

    Candidatos que divergem nao sao resolvidos por preferencia: o resultado e
    marcado como conflito e a questao vai para quarentena.
    """
    candidatos: list[tuple[str, str]] = []
    anulada = False
    linhas = emendar_mencoes(linhas)
    for linha in linhas:
        if _ANULADA.search(linha):
            anulada = True
        _, mencoes = separar_mencoes_de_gabarito(linha)
        for mencoes_texto in mencoes:
            so_valor = _ROTULO_GABARITO.sub("", mencoes_texto)
            res = normalizar_chave_lista(_primeira_frase(so_valor))
            if res.gabarito:
                candidatos.append((res.gabarito, res.metodo))
        concl = _CONCLUSAO_ISOLADA.match(_sem_acentos(linha.strip()))
        if concl:
            mapped = palavra_para_letra(concl.group(1))
            if mapped:
                candidatos.append((mapped, "conclusao"))
    for linha in comentario or []:
        if any(c[1] in ("letra", "palavra", "conclusao") for c in candidatos):
            break
        veredito = _VEREDITO_INICIAL.match(_sem_acentos(linha.strip()))
        if veredito:
            mapped = palavra_para_letra(veredito.group(1))
            if mapped:
                candidatos.append((mapped, "veredito"))
    if anulada and not candidatos:
        return Resolution(None, "anulada", original=None, anulada=True)
    if not candidatos:
        return Resolution(None, "ausente")
    distintos = sorted({letra for letra, _ in candidatos})
    methods = sorted({metodo for _, metodo in candidatos})
    if len(distintos) > 1:
        return Resolution(
            None,
            "+".join(methods),
            original=" | ".join(f"{l}({m})" for l, m in candidatos),
            candidatos=tuple(distintos),
            conflitado=True,
        )
    return Resolution(
        distintos[0],
        methods[0] if len(methods) == 1 else "+".join(methods),
        original=" | ".join(f"{l}({m})" for l, m in candidatos),
        candidatos=tuple(distintos),
    )


# ============================================================
# Guardiao contra o normalizeGabarito do importador
# ============================================================


def ts_normalize_gabarito_replica(value: str | None) -> str | None:
    """Replica fiel de ``normalizeGabarito`` (TS 142-151), so para auditoria.

    Nao usar para produzir artefatos: serve para demonstrar, em teste, o que
    o importador faria com cada valor candidato.
    """
    if not value:
        return None
    letters = re.findall(r"[A-E]", value.upper())
    if not letters:
        return None
    distinct = list(dict.fromkeys(letters))
    if len(distinct) == 1:
        return distinct[0]
    return letters[-1]


class GabaritoInseguro(ValueError):
    """Gabarito que o importador TS corromperia ao normalizar."""


def gabarito_importavel(gabarito: str | None) -> str:
    """Valida que o gabarito pode ir para o JSON de importacao sem risco.

    Aceita apenas letras ``A``-``E`` (ou ``C``/``E`` de item Certo/Errado),
    e recusa qualquer valor cujo efeito do importador real nao seja o proprio
    valor -- a prova de seguranca e feita contra a replica, nao contra a minha
    intencao.
    """
    if not gabarito or gabarito not in _LETRAS_VALIDAS:
        raise GabaritoInseguro(
            f"gabarito {gabarito!r} nao e letra A-E; palavra por extenso seria"
            " corrompida pelo normalizeGabarito do importador"
        )
    efeito = ts_normalize_gabarito_replica(gabarito)
    if efeito != gabarito:
        raise GabaritoInseguro(
            f"gabarito {gabarito!r} produziria {efeito!r} no importador"
        )
    return gabarito
