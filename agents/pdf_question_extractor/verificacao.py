# -*- coding: utf-8 -*-
"""Verificacao reproduzivel dos artefatos ja gravados em disco.

Por que existe, se a geracao ja tem portao fail-closed
------------------------------------------------------
``pipeline.escrever`` varre cada artefato **antes** de escreve-lo, e isso e o
que impede saida suja de existir. Mas aquela varredura olha o objeto em
memoria, dentro do processo que o produziu. Conferir o arquivo que efetivamente
caiu em disco -- por outra pessoa, sem reabrir o PDF, quantas vezes for preciso
-- e outra garantia, e e essa que a homologacao pede.

Le do disco e refaz:

1. a varredura de PII/marca sobre o texto cru (mesmos padroes de
   :mod:`redaction`, nao uma reimplementacao);
2. as invariantes numericas que o proprio relatorio afirma;
3. o contrato de entrada do importador real.

Nada aqui escreve. Nada aqui importa.

As listas de aliases tem fonte, porque o importador aceita nomes que o extrator
jamais deveria emitir: ``comentario`` e sinonimo de ``explicacao`` la
(question-import.service.ts:90), entao se essa chave aparecesse num artefato de
import o comentario do compilador entraria no banco pela porta dos fundos.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import hashing, pipeline, redaction, text_clean

#: question-import.service.ts:89 -- cabecalhos que viram ``gabarito``.
ALIASES_GABARITO = frozenset(
    {
        "gabarito",
        "resposta",
        "answer",
        "correct",
        "gabarito_correto",
        "resposta_correta",
        "alternativa_correta",
    }
)
#: question-import.service.ts:90 -- qualquer um destes vira ``explicacao``.
ALIASES_EXPLICACAO = frozenset(
    {"explicacao", "explicação", "justificativa", "explanation", "comentario", "comentário"}
)
#: O que ``artifacts.linha_import`` emite. Fora daqui e chave que o importador
#: ignora (``alt_a``) ou metadado inventado (``orgao`` nao tem coluna).
CHAVES_IMPORT_ESPERADAS = frozenset(
    {
        "enunciado",
        "gabarito",
        "alternativa_a",
        "alternativa_b",
        "alternativa_c",
        "alternativa_d",
        "alternativa_e",
        "topic",
        "banca",
        "cargo",
        "ano",
        "fonte",
    }
)

NOME_RICO = "questoes_aula_14.json"
NOME_IMPORT = "questoes_aula_14_import.json"
NOME_IMPORT_CE = "questoes_aula_14_certo_errado_import.json"
NOME_QUARENTENA = "quarentena_aula_14.json"
NOME_LOCAL = "comentarios_aula_14_LOCAL.json"
NOME_INVENTARIO = "inventario_aula_14.json"
NOME_RELATORIO = pipeline.NOME_RELATORIO

#: Ausencia de qualquer um destes e falha, nao aviso: entrega incompleta.
ESPERADOS = (
    NOME_RICO,
    NOME_IMPORT,
    NOME_IMPORT_CE,
    NOME_QUARENTENA,
    NOME_LOCAL,
    NOME_INVENTARIO,
    NOME_RELATORIO,
)

_ID_LOCAL = re.compile(r"^A\d{1,3}-S\d{1,3}-\d{1,4}$")
LETRAS = frozenset("ABCDE")
CERTO_ERRADO = frozenset({"C", "E"})


@dataclass(frozen=True)
class Falha:
    """Uma violacao concreta, apontando artefato e regra."""

    artefato: str
    regra: str
    detalhe: str

    def linha(self) -> str:
        return "%-42s %-36s %s" % (self.artefato, self.regra, self.detalhe)


@dataclass
class Veredito:
    """Resultado agregado; ``ok`` e o que o CLI devolve como exit code."""

    artefatos: list[str] = field(default_factory=list)
    falhas: list[Falha] = field(default_factory=list)
    avisos: list[Falha] = field(default_factory=list)
    metricas: dict[str, Any] = field(default_factory=dict)
    vistorias: dict[str, dict[str, Any]] = field(default_factory=dict)
    fonte_identidade: str = "sem-fonte"

    @property
    def ok(self) -> bool:
        return bool(self.artefatos) and not self.falhas

    def para_json(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "fonte_identidade": self.fonte_identidade,
            "artefatos": self.artefatos,
            "metricas": self.metricas,
            "vistorias": self.vistorias,
            "falhas": [vars(f) for f in self.falhas],
            "avisos": [vars(f) for f in self.avisos],
        }


def proibidas_de(destino: Path, cache: Path | None, pdf: Path | None) -> tuple[frozenset[str], str]:
    """Re-deriva as strings exatas da mobilia, sem escrever nada.

    O cache de linhas limpas guarda ``mobilia`` (as linhas removidas, como
    chaves), entao da para reconstruir ``proibidas`` a partir dele e dispensar
    o PDF. Sem cache, refaz a deteccao a partir do PDF -- ler bruto nao grava.
    Sem nenhum dos dois, os padroes genericos ainda valem, mas a conferencia de
    identidade nao: isso e dito como aviso, nao varrido para baixo.
    """
    alvo = cache or destino / pipeline.CACHE_NOME
    if alvo.exists():
        return text_clean.Paginas.de_cache(alvo).proibidas, "cache"
    if pdf is not None and pdf.exists():
        mobilia = text_clean.detectar_mobilia(text_clean.ler_brutos(pdf))
        return (
            frozenset(ln for ln in mobilia if not text_clean.NUMERO_DE_PAGINA.match(ln)),
            "pdf",
        )
    return frozenset(), "sem-fonte"


def _ler(destino: Path) -> tuple[dict[str, str], list[Falha]]:
    """Texto cru de cada artefato esperado; ausencia e falha, nao aviso."""
    textos: dict[str, str] = {}
    falhas: list[Falha] = []
    for nome in ESPERADOS:
        caminho = destino / nome
        if not caminho.exists():
            falhas.append(Falha(nome, "artefato_ausente", str(caminho)))
            continue
        textos[nome] = caminho.read_text(encoding="utf-8")
    return textos, falhas


def conferir_pii(
    textos: dict[str, str], proibidas: frozenset[str]
) -> tuple[dict[str, dict[str, Any]], list[Falha]]:
    """Refaz a varredura sobre o que esta no disco, artefato por artefato."""
    vistorias: dict[str, dict[str, Any]] = {}
    falhas: list[Falha] = []
    for nome, texto in sorted(textos.items()):
        v = redaction.vistoriar(texto, proibidas)
        vistorias[nome] = {"limpo": v.limpo, **v.resumo()}
        for a in v.bloqueantes:
            falhas.append(Falha(nome, "bloqueante_" + a.padrao, a.trecho))
    return vistorias, falhas


def conferir_estruturas(textos: dict[str, str]) -> tuple[dict[str, Any], list[Falha]]:
    """Parseia e exige o container de cada artefato (array x objeto)."""
    falhas: list[Falha] = []
    dados: dict[str, Any] = {}
    for nome, texto in sorted(textos.items()):
        try:
            dados[nome] = json.loads(texto)
        except json.JSONDecodeError as exc:
            falhas.append(Falha(nome, "json_invalido", str(exc)))
    for nome in ESPERADOS:
        if nome == NOME_RELATORIO:
            continue
        valor = dados.get(nome)
        if isinstance(valor, list):
            continue
        if valor is not None:
            falhas.append(Falha(nome, "container_deveria_ser_array", type(valor).__name__))
    rel = dados.get(NOME_RELATORIO)
    if rel is not None and not isinstance(rel, dict):
        falhas.append(Falha(NOME_RELATORIO, "container_deveria_ser_objeto", type(rel).__name__))
    return dados, falhas


def conferir_rico(dados: dict[str, Any]) -> tuple[list[Falha], dict[str, Any]]:
    """Identidade secao-escopada, estado de revisao e explicacao sempre vazia.

    ``status``/``isPublic``/``resolucao_status`` sao conferidos item a item
    porque uma regressao em ``artifacts.item_rico`` marcaria 1736 questoes como
    publicias de uma vez, e o portao de escrita so olha PII, nao semantica.

    Gabarito que nao casa com as alternativas e defeito da fonte (o PDF imprime
    ``D)`` duas vezes, ou da letra de um item C/E a um item de A-D), nao chute
    nosso: o invariante nao e "nunca acontece", e "quem assim sozinhou esta
    quarentenado".
    """
    itens = dados.get(NOME_RICO)
    if not isinstance(itens, list):
        return [Falha(NOME_RICO, "inlegivel", "nada a conferir")], {}
    falhas: list[Falha] = []
    vistos: set[str] = set()
    fora_das_alts = 0
    com_aviso_fora_das_alts = 0
    for q in itens:
        id_local = q.get("id_local")
        if not isinstance(id_local, str) or not _ID_LOCAL.match(id_local):
            falhas.append(Falha(NOME_RICO, "id_local_malformado", repr(id_local)))
            continue
        if id_local in vistos:
            falhas.append(Falha(NOME_RICO, "id_local_duplicado", id_local))
        vistos.add(id_local)
        if q.get("status") != "em_revisao":
            falhas.append(Falha(NOME_RICO, "status_fora_de_revisao", "%s: %r" % (id_local, q.get("status"))))
        if q.get("isPublic") is not False:
            falhas.append(Falha(NOME_RICO, "isPublic_verdadeiro", id_local))
        if q.get("resolucao_status") != "pendente_geracao":
            falhas.append(Falha(NOME_RICO, "resolucao_status_alterado", "%s: %r" % (id_local, q.get("resolucao_status"))))
        if q.get("explicacao") is not None:
            falhas.append(Falha(NOME_RICO, "explicacao_preenchida", id_local))
        gabarito = q.get("gabarito")
        if gabarito is not None and gabarito not in LETRAS:
            falhas.append(Falha(NOME_RICO, "gabarito_fora_de_A_E", "%s: %r" % (id_local, gabarito)))
        if "gabarito_fora_das_alternativas" in (q.get("avisos") or []):
            com_aviso_fora_das_alts += 1
        if gabarito and gabarito not in (q.get("alternativas") or {}):
            fora_das_alts += 1
            if not q.get("quarantined"):
                falhas.append(
                    Falha(NOME_RICO, "gabarito_fora_das_alternativas_nao_quarentenado", "%s: %s" % (id_local, gabarito))
                )
        if not q.get("content_hash") or not q.get("body_hash"):
            falhas.append(Falha(NOME_RICO, "hash_ausente", id_local))
    return falhas, {
        #: Letra presente no artefato e fora das alternativas do proprio item.
        "gabarito_fora_das_alternativas": fora_das_alts,
        #: O que o parser declarou. Pode ser maior: quando o bloco diz uma letra
        #: que nao existe no tipo do item, o resolvidor recusa e deixa gabarito
        #: nulo -- o aviso fica, a letra nao. A14-S23-005 e esse caso.
        "itens_com_aviso_de_gabarito_fora": com_aviso_fora_das_alts,
    }



def _conferir_linhas(nome: str, linhas: Any, letras_validas: frozenset[str]) -> list[Falha]:
    """Aplica o contrato do importador a cada linha de um artefato de import."""
    if not isinstance(linhas, list):
        return [Falha(nome, "inlegivel", "nada a conferir")]
    falhas: list[Falha] = []
    for i, row in enumerate(linhas):
        if not isinstance(row, dict):
            falhas.append(Falha(nome, "linha_nao_objeto", "indice %d" % i))
            continue
        chaves = set(row)
        sujas = sorted(chaves & ALIASES_EXPLICACAO)
        if sujas:
            falhas.append(Falha(nome, "chave_de_comentario_no_import", sujas[0]))
        estranhas = sorted(chaves - CHAVES_IMPORT_ESPERADAS)
        if estranhas:
            falhas.append(Falha(nome, "chave_fora_do_contrato", estranhas[0]))
        if any(k.startswith("alt_") for k in chaves):
            falhas.append(Falha(nome, "cabecalho_invalido_alt", "linha %d" % i))
        if not chaves & ALIASES_GABARITO:
            falhas.append(Falha(nome, "sem_cabecalho_de_gabarito", "linha %d" % i))
        if not (row.get("enunciado") or "").strip():
            falhas.append(Falha(nome, "enunciado_vazio", "linha %d" % i))
        gab = row.get("gabarito")
        if gab not in letras_validas:
            falhas.append(Falha(nome, "gabarito_fora_do_tipo", "%s: %r" % ("linha %d" % i, gab)))
        presentes = frozenset(k[-1].upper() for k in chaves if k.startswith("alternativa_"))
        if len(presentes) < 2:
            falhas.append(Falha(nome, "menos_de_2_alternativas", "linha %d: %s" % (i, sorted(presentes))))
        if gab in letras_validas and gab not in presentes:
            falhas.append(Falha(nome, "gabarito_sem_alternativa", "linha %d: %s" % (i, gab)))
    return falhas


def conferir_imports(dados: dict[str, Any]) -> tuple[list[Falha], dict[str, Any]]:
    """Multipla aceita A-E; certo/errado so C/E, sempre com o par Certo/Errado."""
    metricas: dict[str, Any] = {}
    multi = dados.get(NOME_IMPORT)
    ce = dados.get(NOME_IMPORT_CE)
    falhas = _conferir_linhas(NOME_IMPORT, multi, LETRAS)
    falhas += _conferir_linhas(NOME_IMPORT_CE, ce, CERTO_ERRADO)
    metricas["import_multipla"] = len(multi) if isinstance(multi, list) else None
    metricas["import_certo_errado"] = len(ce) if isinstance(ce, list) else None
    if isinstance(ce, list):
        for i, row in enumerate(ce):
            if not isinstance(row, dict):
                continue
            if row.get("alternativa_c") != "Certo" or row.get("alternativa_e") != "Errado":
                falhas.append(Falha(NOME_IMPORT_CE, "par_certo_errado_incorreto", "linha %d" % i))
                break
    return falhas, metricas


def _hash_da_linha(row: dict[str, Any]) -> str:
    """Recompoe o content_hash de uma linha de import, do mesmo modo do rico.

    A linha de import nao carrega ``id_local`` nem ``content_hash`` -- e o
    formato cru do importador. O join com o artefato rico tem de ser pelo
    proprio hash, recalculado aqui com a funcao que o gerador de artefatos usa.
    Sem isso, "quarentenado nao foi importado" seria uma checagem vazia.
    """
    alternativas = {
        chave[-1].upper(): texto
        for chave, texto in row.items()
        if isinstance(chave, str) and chave.startswith("alternativa_")
    }
    return hashing.content_hash_from_import_row(
        row.get("enunciado", ""), alternativas, row.get("gabarito", "") or ""
    )


def conferir_quarentena_disjunta(dados: dict[str, Any]) -> list[Falha]:
    """Nada quarentenado pode chegar ao import; divergencia nao e chute.

    Dois caminhos independentes: o arquivo de quarentena e o flag
    ``quarantined`` do rico tem de concordar entre si, e nenhum hash de item
    quarentenado pode aparecer num artefato de import.
    """
    quar = dados.get(NOME_QUARENTENA)
    ricos = dados.get(NOME_RICO)
    if not isinstance(quar, list) or not isinstance(ricos, list):
        return [Falha(NOME_QUARENTENA, "inlegivel", "nada a cruzar")]
    falhas: list[Falha] = []
    quaranteados = {q.get("id_local") for q in quar if isinstance(q, dict)}
    por_id = {q.get("id_local"): q for q in ricos if isinstance(q, dict)}
    hashes_quarentenados = {
        q.get("content_hash")
        for q in ricos
        if isinstance(q, dict) and q.get("quarantined") and q.get("content_hash")
    }
    for id_local in sorted(x for x in quaranteados if x):
        q = por_id.get(id_local)
        if q is not None and not q.get("quarantined"):
            falhas.append(Falha(NOME_QUARENTENA, "quarentena_incoerente_com_rico", id_local))
    for q in ricos:
        if q.get("quarantined") and q.get("id_local") not in quaranteados:
            falhas.append(Falha(NOME_QUARENTENA, "quarentenado_fora_do_arquivo", str(q.get("id_local"))))
    for nome in (NOME_IMPORT, NOME_IMPORT_CE):
        linhas = dados.get(nome)
        if not isinstance(linhas, list):
            continue
        for i, row in enumerate(linhas):
            if isinstance(row, dict) and _hash_da_linha(row) in hashes_quarentenados:
                falhas.append(Falha(nome, "quarentenado_importado", "linha %d" % i))
    return falhas


def conferir_contagens(dados: dict[str, Any]) -> list[Falha]:
    """As somas que o relatorio afirma tem de fechar com os arquivos do disco.

    ``por_origem_veredicto`` ja foi publicado como ``por_origem_gabarito`` e
    somava o total de itens, nao os itens com letra: quem lesse o relatorio
    entenderia 932/744/82 como decomposicao de ``com_gabarito`` quando e a de
    ``total_itens``. As invariants abaixo impedem que a ambiguidade volte.
    """
    rel = dados.get(NOME_RELATORIO)
    if not isinstance(rel, dict):
        return [Falha(NOME_RELATORIO, "inlegivel", "nada a cruzar")]
    falhas: list[Falha] = []
    c = rel.get("contagens") or {}
    imp = rel.get("importaveis") or {}
    ricos = dados.get(NOME_RICO) or []
    multi = dados.get(NOME_IMPORT) or []
    ce = dados.get(NOME_IMPORT_CE) or []

    def _soma(chave: str) -> int:
        return sum((c.get(chave) or {}).values())

    if "por_origem_gabarito" in c:
        falhas.append(Falha(NOME_RELATORIO, "chave_ambigua_por_origem_gabarito", "foi renomeada"))
    if _soma("com_gabarito_por_origem") != c.get("com_gabarito"):
        falhas.append(
            Falha(
                NOME_RELATORIO,
                "origem_nao_bate_com_gabarito",
                "%d != %s" % (_soma("com_gabarito_por_origem"), c.get("com_gabarito")),
            )
        )
    if _soma("por_origem_veredicto") != c.get("total_itens"):
        falhas.append(
            Falha(
                NOME_RELATORIO,
                "veredicto_nao_bate_com_total",
                "%d != %s" % (_soma("por_origem_veredicto"), c.get("total_itens")),
            )
        )
    if _soma("por_tipo") != c.get("total_itens"):
        falhas.append(Falha(NOME_RELATORIO, "tipo_nao_bate_com_total", str(c.get("total_itens"))))
    if imp.get("total") != len(multi) + len(ce):
        falhas.append(
            Falha(NOME_RELATORIO, "importaveis_nao_batem", "%s != %d" % (imp.get("total"), len(multi) + len(ce)))
        )
    if imp.get("multipla_escolha") != len(multi) or imp.get("certo_errado") != len(ce):
        falhas.append(Falha(NOME_RELATORIO, "contagem_por_tipo_de_import", str(imp)))
    if c.get("total_itens") - c.get("ineditas") != len(ricos):
        falhas.append(
            Falha(
                NOME_RELATORIO,
                "rico_nao_bate_com_total_menos_ineditas",
                "%s-%s != %d" % (c.get("total_itens"), c.get("ineditas"), len(ricos)),
            )
        )
    if imp.get("explicacao_presente") is not False:
        falhas.append(Falha(NOME_RELATORIO, "relatorio_afirma_explicacao_presente", str(imp)))
    inventario = dados.get(NOME_INVENTARIO)
    if isinstance(inventario, list):
        somados = sum(x.get("itens", 0) for x in inventario if isinstance(x, dict))
        if somados != c.get("total_itens"):
            falhas.append(
                Falha(NOME_INVENTARIO, "itens_nao_batem_com_total", "%d != %s" % (somados, c.get("total_itens")))
            )
    return falhas

def conferir_relatorio_contra_reescaneio(dados: dict[str, Any], vistorias: dict[str, Any]) -> list[Falha]:
    """O relatorio diz que o portao passou; o reescaneio tem de dizer o mesmo.

    Detalhe que importa: ``varredura`` dentro do relatorio lista os *outros*
    artefatos. Ele nao grava veredito de si mesmo -- seria o documento que
    atesta a propria limpeza sem nunca ter sido olhado. Aqui, e olhado.
    """
    rel = dados.get(NOME_RELATORIO)
    if not isinstance(rel, dict):
        return [Falha(NOME_RELATORIO, "inlegivel", "nada a cruzar")]
    falhas: list[Falha] = []
    if rel.get("todos_limpos") is not True:
        falhas.append(Falha(NOME_RELATORIO, "relatorio_admite_sujeira", str(rel.get("todos_limpos"))))
    declaradas = rel.get("varredura") or {}
    for nome, res in sorted(declaradas.items()):
        real = vistorias.get(nome)
        if real is None:
            falhas.append(Falha(nome, "varredura_declarada_sem_arquivo", nome))
        elif res.get("limpo") != real["limpo"]:
            falhas.append(
                Falha(nome, "limpeza_divergente", "relatorio=%s disco=%s" % (res.get("limpo"), real["limpo"]))
            )
    if NOME_RELATORIO in declaradas:
        falhas.append(Falha(NOME_RELATORIO, "relatorio_se_autodeclara_limpo", "deve ficar fora de varredura"))
    proprio = vistorias.get(NOME_RELATORIO)
    if proprio is not None and not proprio["limpo"]:
        falhas.append(Falha(NOME_RELATORIO, "relatorio_sujio_no_reescaneio", str(proprio.get("por_padrao"))))
    return falhas


def verificar(destino: Path, cache: Path | None = None, pdf: Path | None = None) -> Veredito:
    """Rodada completa, somente leitura, sobre os artefatos de ``destino``."""
    v = Veredito()
    textos, falhas_leitura = _ler(destino)
    v.falhas.extend(falhas_leitura)
    v.artefatos = sorted(textos)
    if not textos:
        return v

    proibidas, v.fonte_identidade = proibidas_de(destino, cache, pdf)
    if v.fonte_identidade == "sem-fonte":
        v.avisos.append(
            Falha(
                "(todos)",
                "identidade_sem_fonte",
                "padroes genericos valem; strings exatas da mobilia nao re-derivadas",
            )
        )

    vis, f = conferir_pii(textos, proibidas)
    v.vistorias = vis
    v.falhas.extend(f)

    dados, f = conferir_estruturas(textos)
    v.falhas.extend(f)
    f_rico, metricas_rico = conferir_rico(dados)
    v.falhas.extend(f_rico)
    v.metricas.update(metricas_rico)
    f, metricas = conferir_imports(dados)
    v.falhas.extend(f)
    v.metricas.update(metricas)
    v.falhas.extend(conferir_quarentena_disjunta(dados))
    v.falhas.extend(conferir_contagens(dados))
    v.falhas.extend(conferir_relatorio_contra_reescaneio(dados, vis))

    ricos = dados.get(NOME_RICO) or []
    v.metricas["rico"] = len(ricos)
    v.metricas["quarentena"] = len(dados.get(NOME_QUARENTENA) or [])
    v.metricas["local"] = len(dados.get(NOME_LOCAL) or [])
    v.metricas["secoes"] = len(dados.get(NOME_INVENTARIO) or [])
    v.metricas["ids_unicos"] = len({q.get("id_local") for q in ricos if isinstance(q, dict)})
    return v





