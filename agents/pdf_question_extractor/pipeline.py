# -*- coding: utf-8 -*-
"""Pipeline: PDF -> extracao -> recuperacao -> artefatos com portao de PII.

A escrita e sempre precedida da varredura sobre o **JSON serializado**, nao
sobre o enunciado: e o que pega PII que escapou para um campo de metadado,
marca d'agua em nota, ou comentario que vazou por um campo novo.

O relatorio nao transcreve as linhas de mobilia que removeu. A linha de rodape
do material contem o CPF e o nome do comprador; citar isso no relatorio faria
do proprio relatorio um vazamento, e ele reprovaria no portao que ele mesmo
aplica. Ela entra por categoria, ocorrencia e impressao digital.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import artifacts, parser, provenance, recovery, redaction, sections, text_clean
from .hashing import content_hash_from_import_row
from .sections import Secao

PDF_POR_PADRAO = Path(
    r"H:\Meu Drive\plataforma de estudo\cbm-rj\portugues\questoes"
    r"\curso-384118-aula-14-somente-em-pdf-089a-completo.pdf"
)
SAIDA_POR_PADRAO = Path(r"H:\Meu Drive\plataforma de estudo\cbm-rj\portugues\questoes")
CACHE_NOME = ".aula14_linhas_limpas.json"


@dataclass
class Resultado:
    """Saida do pipeline: artefatos em memoria + auditoria."""

    artefatos: list[artifacts.Artefato] = field(default_factory=list)
    questoes: list[parser.Questao] = field(default_factory=list)
    secoes: list[Secao] = field(default_factory=list)
    varreduras: dict[str, dict[str, Any]] = field(default_factory=dict)
    paginas: text_clean.Paginas | None = None


def _assinatura(texto: str) -> str:
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()[:12]


def _categoria(ln: str) -> str:
    """Classifica a linha de mobilia, sem precisar devolvê-la no relatorio."""
    if text_clean.LINHA_PII.match(ln):
        return "cpf_e_nome_do_comprador"
    if text_clean.MARCA_AGUA.match(ln):
        return "marca_dagua_pdf"
    if re.search(r"estrategia\s*concursos", ln, re.IGNORECASE):
        return "rodape_do_compilador"
    if re.match(r"^\d{1,4}$", ln):
        return "numero_de_pagina"
    return "cabecalho_de_aula"


def resumo_mobilia(paginas: text_clean.Paginas) -> list[dict[str, Any]]:
    """Resume a mobilia removida sem transcrever conteudo sensivel."""
    saida: dict[str, dict[str, Any]] = {}
    for ln, ocorrencias in paginas.mobilia.items():
        registro = saida.setdefault(
            _categoria(ln),
            {"categoria": _categoria(ln), "ocorrencias": 0, "distintas": 0, "assinaturas": []},
        )
        registro["ocorrencias"] += ocorrencias
        registro["distintas"] += 1
        registro["assinaturas"].append(_assinatura(ln))
    return sorted(saida.values(), key=lambda r: -r["ocorrencias"])


def construir(pdf_path: Path = PDF_POR_PADRAO, cache_path: Path | None = None) -> Resultado:
    """Extrai, recupera e monta os artefatos (sem escrever nada ainda)."""
    cache = cache_path or pdf_path.parent / CACHE_NOME
    paginas = text_clean.carregar(pdf_path, cache)
    secoes = sections.parsear_indice(paginas.linhas)
    resultados = parser.extrair_tudo(paginas.linhas, secoes)
    questoes = [q for r in resultados for q in r.questoes]

    recuperacao = recovery.recuperar_por_corpo(questoes)
    duplicatas = recovery.marcar_duplicatas(questoes)

    r = Resultado(questoes=questoes, secoes=secoes, paginas=paginas)
    r.varreduras["_secao_resultados"] = {"valor": len(resultados)}

    #: Importavel = sem nenhum problema, com gabarito, e copia canonica.
    importaveis = [
        q
        for q in questoes
        if not q.problemas
        and q.resolucao is not None
        and q.resolucao.gabarito
        and duplicatas[q.id_local] == q.id_local
    ]
    multi = [q for q in importaveis if q.tipo == "multipla_escolha"]
    ce = [q for q in importaveis if q.tipo == "certo_errado"]

    #: Inedita nao entra no artefato rico: e autoria do compilador, nao prova.
    ricos = [q for q in questoes if not q.inedita]
    r.artefatos = [
        artifacts.Artefato(
            "questoes_aula_14.json",
            [artifacts.item_rico(q, duplicatas[q.id_local]) for q in ricos],
        ),
        artifacts.Artefato(
            "questoes_aula_14_import.json", [artifacts.linha_import(q) for q in multi]
        ),
        artifacts.Artefato(
            "questoes_aula_14_certo_errado_import.json",
            [artifacts.linha_import_certo_errado(q) for q in ce],
        ),
        artifacts.Artefato(
            "quarentena_aula_14.json",
            [artifacts.quarentena(q) for q in questoes if q.problemas],
        ),
        artifacts.Artefato(
            "comentarios_aula_14_LOCAL.json",
            [artifacts.comentario_local(q) for q in questoes if q.comentario],
            local=True,
        ),
        artifacts.Artefato("inventario_aula_14.json", _inventario(resultados, duplicatas)),
        artifacts.Artefato(
            "relatorio_extracao_aula_14.json",
            _relatorio(r, pdf_path, recuperacao, importaveis, multi, ce),
        ),
    ]
    return r


def _inventario(
    resultados: list[parser.ResultadoSecao], duplicatas: dict[str, str]
) -> list[dict[str, Any]]:
    """Mapa secao -> paginas -> itens, com lacunas de numeracao a mostra."""
    saida = []
    for res in resultados:
        unicos = {duplicatas[q.id_local] for q in res.questoes}
        saida.append(
            {
                "secao": res.secao.numero,
                "tipo": res.secao.tipo,
                "tema": res.secao.tema,
                "pagina_inicial": res.secao.pagina_inicial,
                "pagina_final": res.secao.pagina_final,
                "grupos": res.grupos,
                "itens": len(res.questoes),
                "itens_unicos": len(unicos),
                "chaves_de_gabarito": len(res.chaves),
                "com_gabarito": sum(1 for q in res.questoes if q.resolucao and q.resolucao.gabarito),
                "ineditas": sum(1 for q in res.questoes if q.inedita),
                "numeracao_ausente": sorted(
                    {p.rsplit(":", 1)[-1] for p in res.problemas if p.startswith("numero_ausente")}
                ),
                "fora_do_fluxo": len(res.linhas_fora),
            }
        )
    return saida


def _por_procedencia(questoes: list[parser.Questao]) -> dict[str, int]:
    saida: dict[str, int] = {}
    for q in questoes:
        estado = provenance.proveniencia_de(q)
        saida[estado] = saida.get(estado, 0) + 1
    return dict(sorted(saida.items()))


def _relatorio(
    r: Resultado,
    pdf_path: Path,
    recuperacao: dict[str, int],
    importaveis: list[parser.Questao],
    multi: list[parser.Questao],
    ce: list[parser.Questao],
) -> dict[str, Any]:
    """Auditoria da extracao. Nao transcreve mobilia nem PII."""
    hashes_reais = [
        content_hash_from_import_row(
            q.enunciado, q.mapa_alternativas, (q.resolucao.gabarito if q.resolucao else "") or ""
        )
        for q in r.questoes
    ]
    return {
        "origem": {
            "arquivo": pdf_path.name,
            "bytes": pdf_path.stat().st_size,
            "paginas": r.paginas.total_paginas if r.paginas else 0,
        },
        "contagens": artifacts.contagens(r.questoes),
        "importaveis": {
            "total": len(importaveis),
            "multipla_escolha": len(multi),
            "certo_errado": len(ce),
            "explicacao_presente": False,
        },
        "recuperacao_por_corpo": recuperacao,
        "mobilia_removida": resumo_mobilia(r.paginas) if r.paginas else [],
        "linhas_descartadas": dict(r.paginas.removidas) if r.paginas else {},
        "hashes": {
            "calculados": len(hashes_reais),
            "distintos": len(set(hashes_reais)),
            "repetidos": len(hashes_reais) - len(set(hashes_reais)),
        },
        "procedencia": _por_procedencia(r.questoes),
        "varredura": r.varreduras,
        "politica": {
            "status": "em_revisao",
            "isPublic": False,
            "explicacao": "comentario do compilador fica so no arquivo LOCAL",
            "resolucao_ia": "pendente_geracao",
            "orgao_inventado": "nenhum; o alvo declarado no PDF e CBM-PE (Soldado)",
        },
    }


def serializar(dados: Any) -> str:
    return json.dumps(dados, ensure_ascii=False, indent=2, default=str) + "\n"


def varrer(r: Resultado, nomes: list[str] | None = None) -> None:
    """Portao fail-closed sobre cada artefato serializado."""
    proibidas = r.paginas.proibidas if r.paginas else frozenset()
    for art in r.artefatos:
        if nomes is not None and art.nome not in nomes:
            continue
        v = redaction.vistoriar(serializar(art.dados), proibidas)
        r.varreduras[art.nome] = {
            "limpo": v.limpo,
            "local": art.local,
            **v.resumo(),
            "avisos": [{"padrao": a.padrao, "trecho": a.trecho} for a in v.avisos[:20]],
        }
        redaction.exigir_limpo(art.nome, v)


NOME_RELATORIO = "relatorio_extracao_aula_14.json"


def _injetar_varredura_no_relatorio(r: Resultado) -> None:
    """Publica o veredito da varredura dentro do proprio relatorio.

    Duas passadas: a primeira valida os artefatos de conteudo; a segunda
    valida o relatorio ja com esses resultados dentro. Sem isso, o documento
    que afirma que o portao passou seria o unico que o portao nunca olhou.
    """
    for art in r.artefatos:
        if art.nome != NOME_RELATORIO:
            continue
        varreduras = {k: v for k, v in sorted(r.varreduras.items()) if not k.startswith("_")}
        art.dados["varredura"] = varreduras
        art.dados["todos_limpos"] = all(v.get("limpo") for v in varreduras.values())


def escrever(r: Resultado, destino: Path = SAIDA_POR_PADRAO) -> list[Path]:
    """Serializa, varre e so entao escreve. Um bloqueio derruba tudo."""
    demais = [a.nome for a in r.artefatos if a.nome != NOME_RELATORIO]
    varrer(r, demais)
    _injetar_varredura_no_relatorio(r)
    varrer(r, [NOME_RELATORIO])

    destino.mkdir(parents=True, exist_ok=True)
    escritos: list[Path] = []
    for art in r.artefatos:
        caminho = destino / art.nome
        caminho.write_text(serializar(art.dados), encoding="utf-8")
        escritos.append(caminho)
    return escritos
