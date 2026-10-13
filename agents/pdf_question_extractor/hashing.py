# -*- coding: utf-8 -*-
"""Porte byte-a-byte do ``computeHash`` do QuestionImportService (TypeScript).

O hash ``contentHash`` e a chave de deduplicacao do importador: divergir em
um unico byte faz a mesma questao ser importada duas vezes. Por isso este
modulo nao e "semelhante" ao TS -- ele e intencionalmente identico:

    const body = [
      q.enunciado,
      ...q.alternativas.map((a) => `${a.letter}:${a.text}`),
      q.gabarito,
    ]
      .join("||")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .replace(/\\s+/g, " ");
    return createHash("sha256").update(body).digest("hex");

Diferencas que precisam ser preservadas de proposito:

* NAO ha ``trim()`` no final da normalizacao -- o .replace(/\\s+/g, " ")
  colapsa a whitespace interna mas deixa o espaco das pontas, e o hash e
  calculado sobre esse corpo ainda com espacos nas bordas. So o valor ja
  trimado por ``parseQuestion`` (TS 157-164) entra aqui; trimar de novo
  mudaria o hash.
* Removemos apenas o bloco U+0300-U+036F, e nao toda a categoria ``Mn``
  do Unicode -- outros combining marks precisam sobreviver, igual ao TS.
* ``toLowerCase()`` do JS sobre caracteres exoticos pode divergir de
  ``str.lower()`` do Python (por exemplo, "İ"). O conteudo aqui e
  portugues de prova, e o teste de golden vectors cobre o conjunto real.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from typing import Iterable, Mapping, Sequence

#: Colunas aceitas pelo importador (LETTER_COLUMNS do TS, linha 99).
IMPORT_LETTERS: tuple[str, ...] = ("A", "B", "C", "D", "E")

#: Separador de campos do corpo, identico ao join("||") do TS.
FIELD_SEPARATOR = "||"

_JOINER = "|"
#: Mesmo bloco do TS: somente U+0300-U+036F, nao a categoria Mn inteira.
_COMBINING_MARKS = re.compile(r"[\u0300-\u036f]")
_WHITESPACE = re.compile(r"\s+")


def normalize_for_hash(text: str) -> str:
    """Aplica a normalizacao do TS: minusculas, NFD, sem acentos, colapso.

    Nao faz ``strip``: o TS tambem nao faz, e o espaco de borda faz parte
    do hash.
    """
    lowered = text.lower()
    decomposed = unicodedata.normalize("NFD", lowered)
    stripped_accents = _COMBINING_MARKS.sub("", decomposed)
    return _WHITESPACE.sub(" ", stripped_accents)


def build_hash_body(
    enunciado: str,
    alternativas: Mapping[str, str] | Sequence[tuple[str, str]],
    gabarito: str,
) -> str:
    """Monta o corpo pre-normalizacao na ordem exata do TS.

    Alternativas podem virar dict ou pares ordenados; a ordem e sempre a de
    ``IMPORT_LETTERS`` para itens que nao definem ordem propria.
    """
    if isinstance(alternativas, Mapping):
        ordered = [(letra, alternativas[letra]) for letra in IMPORT_LETTERS if letra in alternativas]
    else:
        ordered = list(alternativas)
    fields = [enunciado]
    fields.extend(f"{letra}:{texto}" for letra, texto in ordered)
    fields.append(gabarito)
    return FIELD_SEPARATOR.join(fields)


def content_hash(
    enunciado: str,
    alternativas: Mapping[str, str] | Sequence[tuple[str, str]],
    gabarito: str,
) -> str:
    """Retorna o ``contentHash`` sha256 hex-compativel com o importador."""
    body = build_hash_body(enunciado, alternativas, gabarito)
    return hashlib.sha256(normalize_for_hash(body).encode("utf-8")).hexdigest()


def _trimmed_alternatives(
    alternativas: Mapping[str, str] | Sequence[tuple[str, str]],
) -> list[tuple[str, str]]:
    """Espelha ``parseQuestion``: trim por letra e descarte de vazias."""
    if isinstance(alternativas, Mapping):
        items = [(letra, alternativas.get(letra, "")) for letra in IMPORT_LETTERS]
    else:
        items = [(letra, texto) for letra, texto in alternativas]
    out: list[tuple[str, str]] = []
    for letra, texto in items:
        clean = (texto or "").strip()
        if clean:
            out.append((letra, clean))
    return out


def flattened_hash_fields(
    enunciado: str,
    alternativas: Mapping[str, str] | Sequence[tuple[str, str]],
    gabarito: str,
) -> tuple[str, list[tuple[str, str]], str]:
    """Aplica o trim do importador e devolve o triplo que entra no hash."""
    return (enunciado or "").strip(), _trimmed_alternatives(alternativas), (gabarito or "").strip()


def content_hash_from_import_row(
    enunciado: str,
    alternativas: Mapping[str, str] | Sequence[tuple[str, str]],
    gabarito: str,
) -> str:
    """Hash calculado apos o trim, igual ao caminho real de importacao.

    ``parseQuestion`` trima enunciado e alternativas e descarta alternativas
    vazias ANTES de o ``computeHash`` rodar. Quem gera artefato deve usar
    esta funcao para que o hash gravado seja o mesmo que o importador recal-
    culara ao subir o arquivo.
    """
    clean_enun, clean_alt, clean_gab = flattened_hash_fields(enunciado, alternativas, gabarito)
    return content_hash(clean_enun, clean_alt, clean_gab)


def body_hash(
    enunciado: str,
    alternativas: Mapping[str, str] | Sequence[tuple[str, str]],
) -> str:
    """Hash do corpo SEM gabarito: e a chave de aproximacao entre copias.

    A mesma questao aparece na secao comentada e na lista da apostila. O
    ``contentHash`` do importador inclui o gabarito, entao duas copias com
    gabarito desconhecido nao se encontram por ele. Aqui o gabarito fica de
    fora de proposito, e a coincidencia de corpo e o que permite tomar o
    gabarito de uma copia para a outra -- com o doador registrado, nunca em
    silencio.
    """
    clean_enun, clean_alt, _ = flattened_hash_fields(enunciado, alternativas, "")
    corpo = FIELD_SEPARATOR.join([clean_enun] + [f"{letra}:{texto}" for letra, texto in clean_alt])
    return hashlib.sha256(normalize_for_hash(corpo).encode("utf-8")).hexdigest()


def import_row_fields(
    enunciado: str,
    alternativas: Mapping[str, str] | Sequence[tuple[str, str]],
    gabarito: str,
) -> dict[str, str]:
    """Monta as chaves aceitas pelo importador (``alternativa_a`` ... ``e``).

    ``resolveColumn`` (TS 105-118) so reconhece ``a``/``alternativa_a``/
    ``opcao_a``/``option_a`` como alternativa. ``alt_a`` **nao** esta na
    lista de aliases: e o nome interno do objeto ``values``, nao um cabecalho
    valido. Usar ``alt_a`` no artefato jogaria todas as alternativas fora.
    """
    clean_enun, clean_alt, clean_gab = flattened_hash_fields(enunciado, alternativas, gabarito)
    row: dict[str, str] = {"enunciado": clean_enun, "gabarito": clean_gab}
    for letra, texto in clean_alt:
        row[f"alternativa_{letra.lower()}"] = texto
    return row
