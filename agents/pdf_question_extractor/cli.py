# -*- coding: utf-8 -*-
"""CLI do extrator da Aula 14.

    python -m agents.pdf_question_extractor.cli extract [--pdf ...] [--dest ...]
    python -m agents.pdf_question_extractor.cli resumo

Nenhum subcomando escreve no banco nem publica: a geracao para em artefatos JSON
em estado de revisao. Importar continua sendo ato separado, humano.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import pipeline, redaction, verificacao


def _cmd_extract(args: argparse.Namespace) -> int:
    pdf = Path(args.pdf)
    if not pdf.exists():
        print("PDF nao encontrado: %s" % pdf, file=sys.stderr)
        return 2
    destino = Path(args.dest)
    print("lendo %s" % pdf.name)
    r = pipeline.construir(pdf, Path(args.cache) if args.cache else None)
    print(
        "secoes=%d itens=%d com_gabarito=%d quarentena=%d"
        % (
            len(r.secoes),
            len(r.questoes),
            sum(1 for q in r.questoes if q.resolucao and q.resolucao.gabarito),
            sum(1 for q in r.questoes if q.problemas),
        )
    )
    try:
        escritos = pipeline.escrever(r, destino)
    except redaction.PIIEmArtefato as erro:
        print("BLOQUEADO: %s" % erro, file=sys.stderr)
        return 3
    for caminho in escritos:
        print("  escrito %s" % caminho.name)
    print("varredura:")
    for nome, v in sorted(r.varreduras.items()):
        if nome.startswith("_"):
            continue
        print("  %-44s limpo=%s %s" % (nome, v.get("limpo"), v.get("por_padrao") or {}))
    return 0


def _cmd_resumo(args: argparse.Namespace) -> int:
    origem = Path(args.relatorio)
    if not origem.exists():
        print("relatorio ausente; rode `extract` primeiro: %s" % origem, file=sys.stderr)
        return 2
    dados = json.loads(origem.read_text(encoding="utf-8"))
    print(json.dumps(dados.get("contagens"), ensure_ascii=False, indent=2))
    print(json.dumps(dados.get("importaveis"), ensure_ascii=False, indent=2))
    print(json.dumps(dados.get("procedencia"), ensure_ascii=False, indent=2))
    return 0


def _cmd_verificar(args: argparse.Namespace) -> int:
    """Le os artefatos do disco e devolve exit code: 0 aprovado, 1 reprovado.

    So leitura. Rodar isso depois de ``extract`` e o que transforma a frase
    "o portao passou" em algo que outra pessoa confere sem repetir a geracao.
    """
    destino = Path(args.dest)
    cache = Path(args.cache) if args.cache else None
    pdf = Path(args.pdf) if args.pdf else None
    v = verificacao.verificar(destino, cache=cache, pdf=pdf)

    if args.json:
        print(json.dumps(v.para_json(), ensure_ascii=False, indent=2))
        return 0 if v.ok else 1

    print("verificacao em %s" % destino)
    print(
        "  artefatos lidos = %d/%d | fonte de identidade = %s"
        % (len(v.artefatos), len(verificacao.ESPERADOS), v.fonte_identidade)
    )
    for chave, valor in sorted(v.metricas.items()):
        print("  %-22s %s" % (chave, valor))
    print("  vistoria:")
    for nome, res in sorted(v.vistorias.items()):
        print("    %-46s limpo=%s %s" % (nome, res["limpo"], res.get("por_padrao") or {}))
    if v.avisos:
        print("  avisos:")
        for a in v.avisos:
            print("    AVISO " + a.linha())
    if v.falhas:
        print("FALHAS (%d):" % len(v.falhas))
        for f in v.falhas[:40]:
            print("  " + f.linha())
        if len(v.falhas) > 40:
            print("  ... %d omitidas" % (len(v.falhas) - 40))
        print("VEREDITO: REPROVADO")
        return 1
    print("VEREDITO: APROVADO")
    return 0


def montar_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="pdf_question_extractor", description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)

    e = sub.add_parser("extract", help="extrai o PDF e grava os artefatos")
    e.add_argument("--pdf", default=str(pipeline.PDF_POR_PADRAO))
    e.add_argument("--dest", default=str(pipeline.SAIDA_POR_PADRAO))
    e.add_argument("--cache", default=None, help="arquivo de linhas limpas ja gerado")
    e.set_defaults(func=_cmd_extract)

    s = sub.add_parser("resumo", help="mostra o relatorio ja gravado")
    s.add_argument(
        "--relatorio",
        default=str(pipeline.SAIDA_POR_PADRAO / "relatorio_extracao_aula_14.json"),
    )
    s.set_defaults(func=_cmd_resumo)

    v = sub.add_parser(
        "verificar",
        help="reconfere os artefatos gravados em disco (somente leitura)",
    )
    v.add_argument("--dest", default=str(pipeline.SAIDA_POR_PADRAO))
    v.add_argument("--cache", default=None, help="cache de linhas limpas para re-derivar proibidas")
    v.add_argument("--pdf", default=None, help="usado so se nao houver cache; nao escreve")
    v.add_argument("--json", action="store_true", help="saida machine-readable")
    v.set_defaults(func=_cmd_verificar)
    return p


def main(argv: list[str] | None = None) -> int:
    args = montar_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
