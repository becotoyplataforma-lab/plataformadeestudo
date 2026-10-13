# -*- coding: utf-8 -*-
"""Varredura de PII e de marca de origem, em dois niveis.

A varredura estreita demais vaza; a larga demais aborta sobre conteudo
legitimo e acaba desligada por cansaco. Os dois casos foram observados de
fato neste PDF:

* ``(?<!\\d)\\d{11}(?!\\d)`` sozinho casa com ``46675766891`` -- numero de
  post de uma URL de citacao dentro de uma questao. Errado como bloqueio.
* ``fernando|morae|neves`` casa com ``Vinicius de Moraes``, ``Fernando
  Henrique Cardoso``, ``Luís Fernando Verissimo`` -- autores citados nas
  questoes. Errado como bloqueio.

Donde a separacao em dois niveis:

* **bloqueante**: alta precisao. CPF com digitos verificadores validos
  (modulo 11) e CPF mascarado; marca d'agua ``==bXXXX==``; marca/canais do
  compilador; e qualquer linha que a limpeza detectou como mobilia,
  bloqueada por identidade exata.
* **aviso**: padroes de baixa precisao que viram lista para revisao humana,
  sem derrubar a geracao.

O nome do comprador nunca e escrito em codigo-fonte: ele chega aqui pela
lista ``proibidas``, calculada em runtime a partir das linhas que se repetem
no rodape de quase todas as paginas.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Iterable

#: 11 digitos seguidos, com digitos verificadores modulo 11 conferidos.
_CPF_SOLTO = re.compile(r"(?<!\d)\d{11}(?!\d)")
#: CPF mascarado ou formatado: 000.000.000-00.
_CPF_FORMATADO = re.compile(r"(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)")
_MARCA_AGUA = re.compile(r"={2,}\s*[0-9a-fA-F]{4,8}\s*={2,}")
#: Canais/marca do compilador. Nada de marca de plataforma em artefato.
_MARCA_ORIGEM = re.compile(
    r"estrategia\s*concursos|estrategiaconcursos\.com\.br", re.IGNORECASE
)
#: Sequencias longas de digitos que merecem olhar humano, mas nao bloqueio.
_DIGITOS_LONGOS = re.compile(r"(?<!\d)\d{9,}(?!\d)")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_TELEFONE = re.compile(r"(?<!\d)(?:\+55\s?)?(?:\(?1[1-9]\)?\s?)9?\d{4}[-\s]?\d{4}(?!\d)")


def _digito_verificador(cpf9: str) -> int:
    """Digito verificador modulo 11 do algoritmo oficial do CPF.

    Pesos 10..2 para o primeiro digito e 11..2 para o segundo.
    """
    base = len(cpf9) + 1
    total = sum(int(digito) * (base - posicao) for posicao, digito in enumerate(cpf9))
    resto = total % 11
    return 0 if resto < 2 else 11 - resto


def cpf_valido(cadeia: str) -> bool:
    """Confere os dois digitos verificadores de uma sequência de 11 digitos."""
    if not re.fullmatch(r"\d{11}", cadeia):
        return False
    if len(set(cadeia)) == 1:  # 11111111111 etc.
        return False
    d1 = _digito_verificador(cadeia[:9])
    d2 = _digito_verificador(cadeia[:10])
    return cadeia[9] == str(d1) and cadeia[10] == str(d2)


@dataclass(frozen=True)
class Achado:
    """Uma ocorrencia detectada em texto serializado."""

    nivel: str  # "bloqueante" | "aviso"
    padrao: str
    trecho: str


@dataclass
class Vistoria:
    """Resultado de uma varredura sobre um artefato serializado."""

    achados: list[Achado] = field(default_factory=list)

    @property
    def bloqueantes(self) -> list[Achado]:
        return [a for a in self.achados if a.nivel == "bloqueante"]

    @property
    def avisos(self) -> list[Achado]:
        return [a for a in self.achados if a.nivel == "aviso"]

    @property
    def limpo(self) -> bool:
        return not self.bloqueantes

    def resumo(self) -> dict[str, object]:
        contagem: dict[str, int] = {}
        for a in self.achados:
            contagem[f"{a.nivel}:{a.padrao}"] = contagem.get(f"{a.nivel}:{a.padrao}", 0) + 1
        return {"total": len(self.achados), "por_padrao": contagem}


class PIIEmArtefato(RuntimeError):
    """Artefato contém PII ou marca de origem; escrita abortada."""


def _fold(texto: str) -> str:
    """Desacentua para casar rotulos escritos sem acento no codigo.

    Necessario de verdade: a mobilia do PDF diz ``Estratégia Concursos``, com
    acento, e um padrao ``estrategia\\s*concursos`` sobre o texto original nao
    a veria -- o portao deixaria a marca passar justamente no caso mais comum.
    """
    dobrada = unicodedata.normalize("NFD", texto)
    return "".join(c for c in dobrada if not ("\u0300" <= c <= "\u036f"))


def vistoriar(texto: str, proibidas: Iterable[str] = ()) -> Vistoria:
    """Varre um texto serializado (o JSON inteiro, nao so o enunciado).

    ``proibidas`` sao as strings exatas detectadas como mobilia/PII na
    limpeza: bloquear por identidade pega o dado do comprador sem que o
    nome dele precise estar escrito no repositorio.
    """
    v = Vistoria()
    texto_desacentuado = _fold(texto)
    for cpf in _CPF_SOLTO.findall(texto):
        if cpf_valido(cpf):
            v.achados.append(Achado("bloqueante", "cpf_valido", cpf))
        else:
            v.achados.append(Achado("aviso", "sequencia_11_digitos", cpf))
    for cpf in _CPF_FORMATADO.findall(texto):
        v.achados.append(Achado("bloqueante", "cpf_formatado", cpf))
    for marca in _MARCA_AGUA.findall(texto):
        v.achados.append(Achado("bloqueante", "marca_agua_pdf", marca))
    for marca in _MARCA_ORIGEM.finditer(texto_desacentuado):
        v.achados.append(Achado("bloqueante", "marca_origem", texto[marca.start() : marca.end()]))
    for literal in proibidas:
        if literal and literal in texto:
            v.achados.append(Achado("bloqueante", "mobilia_reincidente", _recorte(literal)))
    for e in _EMAIL.findall(texto):
        v.achados.append(Achado("aviso", "email", e))
    for t in _TELEFONE.findall(texto):
        v.achados.append(Achado("aviso", "telefone", t))
    for bloco in _DIGITOS_LONGOS.findall(texto):
        if len(bloco) > 11:
            v.achados.append(Achado("aviso", "digitos_longos", bloco))
    return v


def _recorte(texto: str, limite: int = 48) -> str:
    """Devolve um trecho truncado, sem reintroduzir o dado inteiro no log."""
    return texto[:limite] + ("..." if len(texto) > limite else "")


def exigir_limpo(nome: str, vistoria: Vistoria) -> None:
    """Fail-closed: aborta se houver bloqueante no artefato ``nome``."""
    if not vistoria.limpo:
        detalhes = "; ".join(
            f"{a.padrao}:{a.trecho}" for a in vistoria.bloqueantes[:8]
        )
        raise PIIEmArtefato(
            f"artefato {nome!r} reprovado na varredura de PII/marca: {detalhes}"
        )
