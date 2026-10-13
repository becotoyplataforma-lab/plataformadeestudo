# -*- coding: utf-8 -*-
"""Máquina de estados que transforma linhas limpas em questões.

Formas medidas no PDF que este módulo precisa tratar:

* ``1. (BANCA / CARGO / ANO)`` e ``47. Orgao - UF / 2024`` (sem parenteses)
* alternativas ``A) ... E)`` ou ``A) ... D)``, em linha propria **ou inline**
  no fim do enunciado (``apesar B) como C) embora D) porque E) portanto``)
* itens Certo/Errado sem alternativa (24 em 100 na secao 1) e também a forma
  explicita ``C) Certo`` + ``E) Errado``
* ``Comentarios:`` / ``Comentario:`` abrindo o bloco do compilador
* gabarito inline (``... Gabarito: Errado.``), sem dois-pontos
  (``Gabarito Letra D.``), como conclusao (``Questao incorreta.``), abrindo a
  linha do comentario (``Incorreto. ...``) e quebrado entre duas linhas
* bloco de chaves ao fim do grupo, precedido de uma linha autonoma
  ``GABARITO``, com linhas ``6. LETRA A``, ``12.LETRA B``, ``1. ERRADO``,
  ``3. CORRETA``
* grupos que reiniciam a numeracao em ``0.``/``1.`` **sem** linha ``GABARITO``
  (medido na secao 4)

Ancoras sao reconhecidas por numero **estritamente crescente dentro do
grupo**, com reinicio permitido em 0/1. Exigir "exatamente o proximo" trava o
contador na primeira ancora perdida e engole o resto da secao inteiro.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field, replace

from .exam_tags import (
    Tag,
    desfazer_fragmentacao,
    eh_linha_de_chave,
    interpretar_tag,
    numero_de_ancora,
)
from .gabarito import (
    CERTO_ERADO_ALTERNATIVAS,
    Resolution,
    normalizar_chave_lista,
    palavra_para_letra,
    resolver_de_blocos,
    separar_mencoes_de_gabarito,
)
from .sections import Secao

#: Rotulo de secao: ``QUESTOES COMENTADAS - ORTOGRAFIA`` em linha autonoma.
_TITULO = re.compile(r"^(QUEST[ÕO]ES COMENTADAS|LISTA DE QUEST[ÕO]ES)\b", re.IGNORECASE)
#: Marco do bloco de chaves.
_INICIO_GABARITOS = re.compile(r"^GABARITOS?\s*:?\s*$", re.IGNORECASE)
_COMENTARIO = re.compile(r"^COMENT[ÁA]RIOS?\s*:?\s*$", re.IGNORECASE)
_ANCORA_QUEBRADA = re.compile(r"^\d{1,3}\.\s*$")
_INEDITA_LINHA = re.compile(r"QUEST[ÃA]O\s+IN[ÉE]DITA", re.IGNORECASE)

_ORDEM_LETRAS = "ABCDE"
#: Marcador de alternativa, com ou sem maiuscula, sempre precedido de
#: nao-palavra (para nao casar o "B)" de "AB)" nem de "3B)").
_MARCADOR_ALT = re.compile(r"(?<!\w)([A-Ea-e])\)\s*")
#: Letra de alternativa que sobrou **dentro** do texto de outra. As colunas do
#: PDF sao lidas entrelacadas: o bloco ``A) ... C) ... B) ... D)`` produz duas
#: opcoes contiguas a partir de A, entao a checagem de sequencia nao ve nada e
#: o gabarito passa a apontar para uma opcao que engoliu outras duas. Medido na
#: Aula 14: 6 itens chegaram ao import assim (docs/30-ATA-HOMOLOGACAO §6).
#: Maiuscula e obrigatoria: ``(IA)``/``IVA)`` sao prosa, nao marcador.
_MARCA_DENTRO_DA_ALTERNATIVA = re.compile(r"(?<!\w)([A-E])\)\s")


@dataclass
class Alternativa:
    letra: str
    texto: str


@dataclass
class Questao:
    """Uma questão extraída, com procedência e problemas declarados."""

    numero: int
    secao: Secao
    id_local: str
    tag: Tag
    pagina_inicial: int
    pagina_final: int
    enunciado: str
    grupo: int = 1
    numero_original: int = 0
    alternativas: list[Alternativa] = field(default_factory=list)
    tipo: str = "multipla_escolha"
    resolucao: Resolution | None = None
    comentario: list[str] = field(default_factory=list)
    origem_gabarito: str = "comentario"
    doador_gabarito: str | None = None
    problemas: list[str] = field(default_factory=list)

    @property
    def inedita(self) -> bool:
        return self.tag.inedita

    @property
    def mapa_alternativas(self) -> dict[str, str]:
        return {a.letra: a.texto for a in self.alternativas}


@dataclass
class ResultadoSecao:
    """Questoes de uma secao, com chaves por grupo e lacunas anotadas."""

    secao: Secao
    questoes: list[Questao] = field(default_factory=list)
    #: Chaves por grupo, em ``"grupo:numero_original"``.
    chaves: dict[str, Resolution] = field(default_factory=dict)
    grupos: int = 0
    linhas_fora: list[str] = field(default_factory=list)
    problemas: list[str] = field(default_factory=list)

    @property
    def maior_numero(self) -> int:
        return max((q.numero for q in self.questoes), default=0)




def extrair_chaves(linhas_gabarito: list[tuple[int, str]]) -> dict[int, Resolution]:
    """Parseia o bloco ``GABARITO`` de um grupo.

    Formas medidas: ``6. LETRA A``, ``12.LETRA B`` (sem espaco), ``1. ERRADO``,
    ``3. CORRETA``, ``10. INCORRETA``. Numero repetido com valores diferentes
    nao e resolvido por preferencia: vira conflito e a questao e quarentenada.
    """
    chaves: dict[int, Resolution] = {}
    for _, ln in linhas_gabarito:
        m = re.match(r"^(\d{1,3})\.\s*(.+)$", ln.strip())
        if not m:
            continue
        corpo = m.group(2).strip()
        if not eh_linha_de_chave(corpo):
            continue
        numero = int(m.group(1))
        res = normalizar_chave_lista(corpo)
        anterior = chaves.get(numero)
        if anterior is not None and anterior.gabarito != res.gabarito:
            chaves[numero] = Resolution(
                None,
                "chaves_conflitantes",
                original=f"{anterior.original} vs {res.original}",
                conflitado=True,
            )
        elif anterior is None:
            chaves[numero] = res
    return chaves


def _dividir_grupos(
    corpo: list[tuple[int, str]],
) -> list[tuple[list[tuple[int, str]], list[tuple[int, str]]]]:
    """Quebra o corpo da secao em grupos ``(linhas de questoes, linhas de chaves)``.

    Dois gatilhos medidos, e os dois sao necessarios:

    * linha autonoma ``GABARITO``, seguida pelas chaves do grupo;
    * reinicio de numeracao em ``0.``/``1.`` sem nenhuma linha ``GABARITO``
      (secao 4: ``7. (POLICIA MILITAR PE / 2024)`` e logo depois
      ``0. (CRO RR / AGENTE / 2024)``, ``0. (IPEA / Analista / 2024)``,
      ``1. (UNEMAT ...)``).

    Sem o segundo gatilho a secao 4 perdeu 9 questoes, porque o filtro de
    monotonicidade descartava toda ancora com numero menor que a anterior.
    """
    grupos: list[tuple[list[tuple[int, str]], list[tuple[int, str]]]] = []
    atual: list[tuple[int, str]] = []
    chaves: list[tuple[int, str]] = []
    em_chave = False
    ultimo = -1

    def fechar() -> None:
        nonlocal atual, chaves
        if atual:
            grupos.append((atual, chaves))
        elif chaves and grupos:
            #: Chaves sem corpo: junta ao grupo anterior, que e a quem elas
            #: respondem (o bloco GABARITO fecha a secao, nao abre uma nova).
            corpo_anterior, chaves_anteriores = grupos[-1]
            grupos[-1] = (corpo_anterior, chaves_anteriores + chaves)
        atual, chaves = [], []

    for item in corpo:
        linha = item[1].strip()
        if _INICIO_GABARITOS.match(linha):
            em_chave = True
            continue
        achado = numero_de_ancora(linha)
        if achado is not None:
            numero = achado[0]
            if em_chave:
                em_chave = False
                fechar()
            if numero <= ultimo and numero <= 1:
                fechar()
            ultimo = numero
        (chaves if em_chave else atual).append(item)

    fechar()
    return grupos


def _sequencia_de_alternativas(texto: str) -> list[tuple[str, int, int]]:
    """A maior corrida A)B)C)... (ou a)b)c)...) do texto, em ordem.

    Exigir continuidade e o que impede um ``B)`` citado dentro do enunciado
    de abrir uma alternativa falsa. Retorna tambem corridas comecando em
    letras posteriores, porque ha itens cuja alternativa A vem quebrada.
    """
    encontradas = [(m.group(1).upper(), m.start(), m.end()) for m in _MARCADOR_ALT.finditer(texto)]
    melhor: list[tuple[str, int, int]] = []
    for inicio in range(len(_ORDEM_LETRAS) - 1):
        corrida: list[tuple[str, int, int]] = []
        fronteira = -1
        for letra, ini, fim in encontradas:
            if ini < fronteira:
                continue
            if letra == _ORDEM_LETRAS[inicio + len(corrida)]:
                corrida.append((letra, ini, fim))
                fronteira = fim
                if inicio + len(corrida) >= len(_ORDEM_LETRAS):
                    break
        if len(corrida) > len(melhor) and len(corrida) >= 2:
            melhor = corrida
    return melhor


def _texto_normalizado(texto: str) -> str:
    """Minúsculas, sem acentos (mesmo bloco do hashing) e sem pontuação."""
    dobrada = unicodedata.normalize("NFD", texto.lower())
    dobrada = "".join(c for c in dobrada if not ("\u0300" <= c <= "\u036f"))
    return re.sub(r"[^a-z]", "", dobrada)


def _marcas_embutidas(alternativas: list[Alternativa]) -> list[tuple[str, str]]:
    """Pares ``(letra_da_opcao, letra_embutida)`` denotando colunas entrelacadas.

    A letra própria da opcao nao conta: o marcador que abriu o texto ja foi
    consumido pela particao, entao o que sobra aqui e sempre outra opcao.
    """
    embutidas: list[tuple[str, str]] = []
    for alt in alternativas:
        for marca in _MARCA_DENTRO_DA_ALTERNATIVA.finditer(alt.texto or ""):
            if marca.group(1) != alt.letra:
                embutidas.append((alt.letra, marca.group(1)))
    return embutidas


def _eh_item_certo_errado(alternativas: list[Alternativa]) -> bool:
    """``C) Certo`` + ``E) Errado`` explícitos: é item C/E, não escolha simples.

    Usa o vocabulário de ``gabarito.palavra_para_letra`` em vez de manter lista
    própria: listas gêmeas divergem -- a primeira versão não conhecia
    "incorreta", o feminino que o próprio PDF usa nas chaves. Compara letra a
    letra, então um item com C e E invertidos não passa por C/E legítimo.
    """
    por_letra = {a.letra: _texto_normalizado(a.texto) for a in alternativas}
    if set(por_letra) != {"C", "E"}:
        return False
    return (
        palavra_para_letra(por_letra["C"]) == "C"
        and palavra_para_letra(por_letra["E"]) == "E"
    )


def _dividir_blocos(linhas: list[str]) -> tuple[list[str], list[Alternativa], list[str]]:
    """Separa enunciado, alternativas e comentário de um bloco.

    O comentário é cortado **antes** de procurar alternativas: o próprio
    comentário reproduz as opções da questão (medido: blocos com 7 a 10
    marcadores ``A)``-``E)`` na seção 1), e aceitá-los criaria alternativas
    duplicadas no import.

    A menção de gabarito colada numa alternativa (``d) ... Gabarito letra B.``)
    sai do texto, mas não do bloco bruto -- o resolvedor continua vendo-a.
    """
    pre: list[str] = []
    comentario: list[str] = []
    fase = "pre"
    for ln in linhas:
        texto = ln.strip()
        if not texto or _ANCORA_QUEBRADA.match(texto):
            continue
        if _COMENTARIO.match(texto):
            fase = "comentario"
            continue
        (pre if fase == "pre" else comentario).append(texto)

    texto_pre = " ".join(pre)
    marc = _sequencia_de_alternativas(texto_pre)
    if not marc:
        limpo, _ = separar_mencoes_de_gabarito(texto_pre)
        return ([limpo] if limpo else []), [], comentario

    alternativas: list[Alternativa] = []
    for i, (letra, _ini, fim_marc) in enumerate(marc):
        fim = marc[i + 1][1] if i + 1 < len(marc) else len(texto_pre)
        bruto = texto_pre[fim_marc:fim].strip()
        limpo, _mencao = separar_mencoes_de_gabarito(bruto)
        alternativas.append(Alternativa(letra, limpo))
    enunciado, _ = separar_mencoes_de_gabarito(texto_pre[: marc[0][1]].strip())
    return ([enunciado] if enunciado else []), alternativas, comentario


def _resolver_tipo(q: Questao) -> None:
    """Classifica ``multipla_escolha`` x ``certo_errado`` e normaliza C/E.

    Item Certo/Errado não tem alternativa no PDF (medido: 24 em 100 itens sem
    alternativa alguma na seção 1). Recebe então as alternativas sintéticas
    ``C: Certo`` / ``E: Errado``, e o gabarito fica em LETRA, nunca em palavra.
    """
    if q.alternativas and _eh_item_certo_errado(q.alternativas):
        q.tipo = "certo_errado"
        return

    if q.alternativas:
        q.tipo = "multipla_escolha"
        letras = [a.letra for a in q.alternativas]
        if len(set(letras)) != len(letras):
            q.problemas.append("alternativas_repetidas")
        esperadas = _ORDEM_LETRAS[: len(set(letras))]
        if sorted(set(letras)) != sorted(esperadas):
            q.problemas.append("alternativas_fora_da_sequencia")
        #: Sequencia contigua nao prova particao correta: coluna entrelacada
        #: deixa o marcador da vizinha dentro do texto, e o gabarito passa a
        #: apontar para uma opcao que contem outras. Nada e realinhado a chute.
        if _marcas_embutidas(q.alternativas):
            q.problemas.append("alternativa_com_marca_de_letra")
        return

    q.tipo = "certo_errado"
    q.alternativas = [
        Alternativa(letra, texto) for letra, texto in CERTO_ERADO_ALTERNATIVAS.items()
    ]



def _linhas_da_secao(paginas_linhas: list[list[str]], secao: Secao) -> list[tuple[int, str]]:
    """Linhas ``(pagina, texto)`` da secao, com a pagina real do PDF (1-based)."""
    saida: list[tuple[int, str]] = []
    for indice in secao.range_indice():
        if indice >= len(paginas_linhas):
            break
        saida.extend((indice + 1, ln) for ln in paginas_linhas[indice])
    return saida


def extrair_secao(paginas_linhas: list[list[str]], secao: Secao) -> ResultadoSecao:
    """Extrai as questoes de uma secao, grupo por grupo.

    ``numero`` e um contador corrente da secao, portanto unico (e ele que vira
    ``id_local``); ``numero_original`` preserva o que o PDF imprimiu, inclusive
    o reinicio por grupo e o caso medido de ``0. (...)``. Lacuna de numeracao e
    registrada em ``numero_ausente`` por grupo, nunca remapeada em silencio.
    """
    linhas = desfazer_fragmentacao(_linhas_da_secao(paginas_linhas, secao))
    linhas = [(pg, ln) for pg, ln in linhas if not _TITULO.match(ln.strip())]
    resultado = ResultadoSecao(secao=secao)

    corrente = 0
    for gi, (grupo_linhas, grupo_chaves) in enumerate(_dividir_grupos(linhas), start=1):
        resultado.grupos = gi
        chaves = extrair_chaves(grupo_chaves)
        resultado.chaves.update({"%d:%d" % (gi, n): r for n, r in chaves.items()})

        ancora_em: list[tuple[int, int, Tag]] = []
        ultimo = -1
        pre_ancora: list[str] = []
        for idx, (_, ln) in enumerate(grupo_linhas):
            achado = numero_de_ancora(ln)
            if achado is None:
                if not ancora_em:
                    pre_ancora.append(ln)
                continue
            numero, tag_texto = achado
            if numero <= ultimo:
                continue
            ancora_em.append((idx, numero, interpretar_tag(tag_texto)))
            ultimo = numero

        for pos, (idx, numero, tag) in enumerate(ancora_em):
            fim = ancora_em[pos + 1][0] if pos + 1 < len(ancora_em) else len(grupo_linhas)
            bloco = [grupo_linhas[k][1] for k in range(idx + 1, fim)]
            pagina_inicial = grupo_linhas[idx][0]
            pagina_final = grupo_linhas[fim - 1][0] if fim - 1 > idx else pagina_inicial
            corrente += 1
            resultado.questoes.append(
                _fechar_questao(
                    secao, corrente, numero, gi, tag, bloco,
                    pagina_inicial, pagina_final, chaves,
                )
            )
            anterior = ancora_em[pos - 1][1] if pos else 0
            #: So lacuna DENTRO do grupo conta. O primeiro numero de um grupo
            #: e o que o PDF escolheu (ha grupo de continuacao que abre em 33),
            #: e reportar range(1, 33) como buraco inventaria 32 ausencias.
            if pos:
                resultado.problemas.extend(
                    "numero_ausente:g%d:n%d" % (gi, n)
                    for n in range(anterior + 1, numero)
                    if n > 0
                )

        if pre_ancora:
            resultado.linhas_fora.extend(pre_ancora)
        if not ancora_em:
            resultado.linhas_fora.extend(ln for _, ln in grupo_linhas)
    return resultado


def _fechar_questao(
    secao: Secao,
    numero: int,
    numero_original: int,
    grupo: int,
    tag: Tag,
    bloco: list[str],
    pagina_inicial: int,
    pagina_final: int,
    chaves: dict[int, Resolution],
) -> Questao:
    """Monta a Questao a partir do bloco, resolvendo tipo e gabarito.

    Dois canais de gabarito coexistem no material: o comentario da secao
    comentada e o bloco ``GABARITO`` do grupo. Quando os dois existem e
    divergem, nada e "escolhido" -- a questao vai para quarentena, porque a
    divergencia e um dado sobre o material, nao um detalhe de implementacao.
    """
    enunciado, alternativas, comentario = _dividir_blocos(bloco)
    q = Questao(
        numero=numero,
        secao=secao,
        id_local="A14-S%02d-%03d" % (secao.numero, numero),
        tag=tag,
        pagina_inicial=pagina_inicial,
        pagina_final=pagina_final,
        enunciado=" ".join(enunciado).strip(),
        grupo=grupo,
        numero_original=numero_original,
        alternativas=alternativas,
        comentario=comentario,
    )
    if tag.inedita or any(_INEDITA_LINHA.search(ln) for ln in bloco):
        if not tag.inedita:
            q.tag = replace(
                tag, inedita=True, crua="QUESTÃO INÉDITA", banca=None, orgao=None, cargo=None
            )
        q.problemas.append("conteudo_do_compilador")

    _resolver_tipo(q)

    do_comentario = resolver_de_blocos(bloco, comentario=comentario)
    da_chave = chaves.get(numero_original)
    if (
        da_chave is not None
        and da_chave.gabarito is not None
        and do_comentario.gabarito is not None
        and da_chave.gabarito != do_comentario.gabarito
    ):
        q.resolucao = Resolution(
            None,
            "fontes_divergem",
            original="comentario=%s chave=%s" % (do_comentario.gabarito, da_chave.gabarito),
            conflitado=True,
        )
        q.origem_gabarito = "divergente"
    elif da_chave is not None and (da_chave.gabarito is not None or da_chave.anulada):
        q.resolucao = da_chave
        q.origem_gabarito = "bloco_gabarito"
    else:
        q.resolucao = do_comentario
        q.origem_gabarito = "comentario"
        if secao.tipo == "lista":
            q.problemas.append("sem_chave_no_bloco_gabarito")

    if q.resolucao.gabarito and q.resolucao.gabarito not in q.mapa_alternativas:
        q.problemas.append("gabarito_fora_das_alternativas")
    motivo = q.resolucao.motivo_quarentena
    if motivo:
        q.problemas.append(motivo)
    if not q.enunciado:
        q.problemas.append("enunciado_vazio")
    if q.tipo == "multipla_escolha" and len(q.alternativas) < 2:
        q.problemas.append("alternativas_insuficientes")
    return q


def extrair_tudo(paginas_linhas: list[list[str]], secoes: list[Secao]) -> list[ResultadoSecao]:
    """Extrai todas as secoes, preservando a ordem do indice."""
    return [extrair_secao(paginas_linhas, s) for s in secoes]

