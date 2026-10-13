# -*- coding: utf-8 -*-
"""O verificador de disco precisa reprovar o que o portao de escrita aprovaria.

``pipeline.escrever`` varre o objeto em memoria; ``verificacao.verificar`` varre
o arquivo. Se so a segunda checagem pega um artefato adulterado depois de
gravado, ela tem de pegar -- e se ela nao pega nada num conjunto coerente, ela
e decoracao. Os testes abaixo fecham as duas pontas.
"""

from __future__ import annotations

import json
from pathlib import Path

from agents.pdf_question_extractor import hashing, pipeline, verificacao
from agents.pdf_question_extractor.cli import main
from agents.pdf_question_extractor.verificacao import (
    NOME_IMPORT,
    NOME_INVENTARIO,
    NOME_LOCAL,
    NOME_QUARENTENA,
    NOME_RELATORIO,
    NOME_RICO,
    NOME_IMPORT_CE,
)

CPF_VALIDO = "52998224725"
ID_BOA = "A14-S01-001"
ID_QUARENTENADA = "A14-S01-002"
ID_CE = "A14-S02-001"


def _hash(enunciado: str, alts: dict[str, str], gab: str) -> str:
    return hashing.content_hash_from_import_row(enunciado, alts, gab)


def _item(id_local: str, secao: int, numero: int, enunciado: str, alts: dict[str, str], gab: str, **extra) -> dict:
    item = {
        "id_local": id_local,
        "codigo": id_local,
        "aula": 14,
        "secao": secao,
        "numero_na_secao": numero,
        "tipo": extra.pop("tipo", "multipla_escolha"),
        "enunciado": enunciado,
        "alternativas": alts,
        "gabarito": gab,
        "content_hash": _hash(enunciado, alts, gab),
        "body_hash": "b-" + id_local,
        "status": "em_revisao",
        "isPublic": False,
        "resolucao_status": "pendente_geracao",
        "explicacao": None,
        "quarantined": False,
        "avisos": [],
    }
    item.update(extra)
    return item


def _linha(enunciado: str, alts: dict[str, str], gab: str) -> dict:
    row = {"enunciado": enunciado, "gabarito": gab}
    for letra, texto in alts.items():
        row["alternativa_" + letra.lower()] = texto
    row["topic"] = "Interpretacao de texto"
    return row


def escrever_base(destino: Path) -> dict[str, list]:
    """Um conjunto minimo e coerente: 2 itens bons, 1 quarentenado defeituoso."""
    enun_ok = "Assinale a alternativa correta sobre o verbete."
    alts_ok = {"A": "certa", "B": "errada"}
    enun_ruim = "Questao cujo gabarito do PDF nao corresponde a nenhuma letra."
    alts_ruim = {"A": "uma", "B": "outra"}
    enun_ce = "Julgue: o prazo e de cinco dias."
    alts_ce = {"C": "Certo", "E": "Errado"}

    ricos = [
        _item(ID_BOA, 1, 1, enun_ok, alts_ok, "A"),
        _item(
            ID_QUARENTENADA,
            1,
            2,
            enun_ruim,
            alts_ruim,
            "E",
            quarantined=True,
            avisos=["gabarito_fora_das_alternativas"],
        ),
        _item(ID_CE, 2, 1, enun_ce, alts_ce, "C", tipo="certo_errado"),
    ]
    multi = [_linha(enun_ok, alts_ok, "A")]
    ce = [_linha(enun_ce, {"C": "Certo", "E": "Errado"}, "C")]
    quar = [{"id_local": ID_QUARENTENADA, "motivos": ["gabarito_fora_das_alternativas"]}]
    inventario = [
        {"secao": 1, "itens": 2},
        {"secao": 2, "itens": 1},
    ]
    relatorio = {
        "contagens": {
            "total_itens": 3,
            "ineditas": 0,
            "com_gabarito": 3,
            "por_tipo": {"certo_errado": 1, "multipla_escolha": 2},
            "por_origem_veredicto": {"bloco_gabarito": 3},
            "com_gabarito_por_origem": {"bloco_gabarito": 3},
        },
        "importaveis": {
            "total": 2,
            "multipla_escolha": 1,
            "certo_errado": 1,
            "explicacao_presente": False,
        },
        "varredura": {
            nome: {"limpo": True, "total": 0}
            for nome in (NOME_RICO, NOME_IMPORT, NOME_IMPORT_CE, NOME_QUARENTENA, NOME_LOCAL, NOME_INVENTARIO)
        },
        "todos_limpos": True,
    }
    _escrever(destino, NOME_RICO, ricos)
    _escrever(destino, NOME_IMPORT, multi)
    _escrever(destino, NOME_IMPORT_CE, ce)
    _escrever(destino, NOME_QUARENTENA, quar)
    _escrever(destino, NOME_LOCAL, [{"id_local": ID_BOA, "comentario": "texto do compilador"}])
    _escrever(destino, NOME_INVENTARIO, inventario)
    _escrever(destino, NOME_RELATORIO, relatorio)
    return {"rico": ricos, "multi": multi, "ce": ce, "quar": quar, "relatorio": relatorio}


def _escrever(destino: Path, nome: str, dados: object) -> None:
    (destino / nome).write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")


def _recarregar(destino: Path, nome: str) -> object:
    return json.loads((destino / nome).read_text(encoding="utf-8"))


def regras(v: verificacao.Veredito) -> set[str]:
    return {f.regra for f in v.falhas}


def test_conjunto_coerente_e_aprovado(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    v = verificacao.verificar(tmp_path)
    assert v.ok, [f.linha() for f in v.falhas]
    assert v.metricas["rico"] == 3
    assert v.metricas["import_multipla"] == 1
    assert v.metricas["ids_unicos"] == 3
    #: O item com gabarito que nao casa com as alternativas e defeito da fonte,
    #: contado e exposto, desde que esteja quarentenado.
    assert v.metricas["gabarito_fora_das_alternativas"] == 1
    assert v.metricas["itens_com_aviso_de_gabarito_fora"] == 1


def test_diretorio_vazio_reprova(tmp_path: Path) -> None:
    v = verificacao.verificar(tmp_path)
    assert not v.ok
    assert regras(v) == {"artefato_ausente"}


def test_artefato_ausente_reprova(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    (tmp_path / NOME_RICO).unlink()
    v = verificacao.verificar(tmp_path)
    assert not v.ok
    assert "artefato_ausente" in regras(v)


def test_json_quebrado_reprova(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    (tmp_path / NOME_INVENTARIO).write_text("[{nao fecha", encoding="utf-8")
    v = verificacao.verificar(tmp_path)
    assert "json_invalido" in regras(v)


def test_cpf_valido_injetado_apos_escrita_reprova(tmp_path: Path) -> None:
    """O caso que o portao de escrita nao cobre: o arquivo foi sujo depois."""
    escrever_base(tmp_path)
    linhas = _recarregar(tmp_path, NOME_IMPORT)
    linhas[0]["enunciado"] = "Leitor " + CPF_VALIDO + " pergunta: " + linhas[0]["enunciado"]
    _escrever(tmp_path, NOME_IMPORT, linhas)
    v = verificacao.verificar(tmp_path)
    assert "bloqueante_cpf_valido" in regras(v)


def test_marca_de_origem_injetada_reprova(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    quar = _recarregar(tmp_path, NOME_QUARENTENA)
    quar[0]["procedencia"] = "Estrategia Concursos"
    _escrever(tmp_path, NOME_QUARENTENA, quar)
    v = verificacao.verificar(tmp_path)
    assert "bloqueante_marca_origem" in regras(v)


def test_mobilia_proibida_vem_do_cache_e_reprova(tmp_path: Path) -> None:
    escrever_base(tmp_path)
def test_alternativa_embutida_no_import_reprova(tmp_path: Path) -> None:
    """Coluna entrelacada escrita no arquivo de import: bloqueante no gate de disco.

    O parser ja quarentena o item, mas o gate reconfirma a partir do artefato:
    se a linha chegar ao arquivo por outra mao, o import nao pode ser aprovado.
    """
    escrever_base(tmp_path)
    linhas = _recarregar(tmp_path, NOME_IMPORT)
    linhas[0]["alternativa_a"] = "Separar o aposto. C) Separar o sujeito."
    _escrever(tmp_path, NOME_IMPORT, linhas)
    v = verificacao.verificar(tmp_path)
    assert "alternativa_com_marca_de_letra" in regras(v)
    assert not v.ok


def test_prosa_com_sigla_no_import_nao_reprova(tmp_path: Path) -> None:
    """``(IA)``/``IVA)`` sao prosa, nao marcador: o gate nao pode inventar falha."""
    escrever_base(tmp_path)
    linhas = _recarregar(tmp_path, NOME_IMPORT)
    linhas[0]["alternativa_a"] = "A adocao do imposto sobre valor agregado (IVA) trouxe avanco."
    linhas[0]["alternativa_b"] = "A inteligencia artificial (IA) mudou o calculo."
    _escrever(tmp_path, NOME_IMPORT, linhas)
    v = verificacao.verificar(tmp_path)
    assert "alternativa_com_marca_de_letra" not in regras(v)

    literal = "CURSO DO FULANO DA SILVA"
    (tmp_path / pipeline.CACHE_NOME).write_text(
        json.dumps({"linhas": [[]], "mobilia": {literal: 862}, "removidas": {}}), encoding="utf-8"
    )
    local = _recarregar(tmp_path, NOME_LOCAL)
    local[0]["comentario"] = literal + " comentou"
    _escrever(tmp_path, NOME_LOCAL, local)
    v = verificacao.verificar(tmp_path)
    assert v.fonte_identidade == "cache"
    assert "bloqueante_mobilia_reincidente" in regras(v)


def test_sem_fonte_de_identidade_gera_aviso_explicito(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    v = verificacao.verificar(tmp_path)
    assert v.fonte_identidade == "sem-fonte"
    assert {a.regra for a in v.avisos} == {"identidade_sem_fonte"}
    assert v.ok


def test_chave_de_comentario_no_import_reprova(tmp_path: Path) -> None:
    """``comentario`` e sinonimo de ``explicacao`` no importador: porta dos fundos."""
    escrever_base(tmp_path)
    linhas = _recarregar(tmp_path, NOME_IMPORT)
    linhas[0]["comentario"] = "resolucao do compilador"
    _escrever(tmp_path, NOME_IMPORT, linhas)
    v = verificacao.verificar(tmp_path)
    assert "chave_de_comentario_no_import" in regras(v)


def test_cabecalho_alt_a_reprova(tmp_path: Path) -> None:
    """``alt_a`` nao e cabecalho valido: o importador jogaria as alternativas fora."""
    escrever_base(tmp_path)
    linhas = _recarregar(tmp_path, NOME_IMPORT)
    linhas[0]["alt_a"] = linhas[0]["alternativa_a"]
    _escrever(tmp_path, NOME_IMPORT, linhas)
    v = verificacao.verificar(tmp_path)
    assert {"cabecalho_invalido_alt", "chave_fora_do_contrato"} <= regras(v)


def test_gabarito_fora_do_tipo_reprova(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    linhas = _recarregar(tmp_path, NOME_IMPORT)
    linhas[0]["gabarito"] = "Correto"
    _escrever(tmp_path, NOME_IMPORT, linhas)
    v = verificacao.verificar(tmp_path)
    assert "gabarito_fora_do_tipo" in regras(v)


def test_certo_errado_sem_par_reprova(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    linhas = _recarregar(tmp_path, NOME_IMPORT_CE)
    linhas[0]["alternativa_c"] = "Verdadeiro"
    _escrever(tmp_path, NOME_IMPORT_CE, linhas)
    v = verificacao.verificar(tmp_path)
    assert "par_certo_errado_incorreto" in regras(v)


def test_item_publicado_no_rico_reprova(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    ricos = _recarregar(tmp_path, NOME_RICO)
    ricos[0]["status"] = "publicado"
    ricos[0]["isPublic"] = True
    _escrever(tmp_path, NOME_RICO, ricos)
    v = verificacao.verificar(tmp_path)
    assert {"status_fora_de_revisao", "isPublic_verdadeiro"} <= regras(v)


def test_explicacao_preenchida_no_rico_reprova(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    ricos = _recarregar(tmp_path, NOME_RICO)
    ricos[0]["explicacao"] = "gerada por IA"
    _escrever(tmp_path, NOME_RICO, ricos)
    v = verificacao.verificar(tmp_path)
    assert "explicacao_preenchida" in regras(v)


def test_id_local_duplicado_reprova(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    ricos = _recarregar(tmp_path, NOME_RICO)
    ricos[1]["id_local"] = ID_BOA
    _escrever(tmp_path, NOME_RICO, ricos)
    v = verificacao.verificar(tmp_path)
    assert "id_local_duplicado" in regras(v)


def test_id_local_fora_do_formato_reprova(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    ricos = _recarregar(tmp_path, NOME_RICO)
    ricos[0]["id_local"] = "1"
    _escrever(tmp_path, NOME_RICO, ricos)
    v = verificacao.verificar(tmp_path)
    assert "id_local_malformado" in regras(v)


def test_gabarito_quebrado_nao_pode_sair_da_quarentena(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    ricos = _recarregar(tmp_path, NOME_RICO)
    ricos[1]["quarantined"] = False
    _escrever(tmp_path, NOME_RICO, ricos)
    _escrever(tmp_path, NOME_QUARENTENA, [])
    v = verificacao.verificar(tmp_path)
    assert "gabarito_fora_das_alternativas_nao_quarentenado" in regras(v)


def test_quarentenado_que_volta_pelo_hash_reprova(tmp_path: Path) -> None:
    """A linha importada nao tem id_local: o cruzamento e pelo content_hash."""
    escrever_base(tmp_path)
    ricos = _recarregar(tmp_path, NOME_RICO)
    ruim = ricos[1]
    linhas = _recarregar(tmp_path, NOME_IMPORT)
    linhas.append(_linha(ruim["enunciado"], dict(ruim["alternativas"]), ruim["gabarito"]))
    _escrever(tmp_path, NOME_IMPORT, linhas)
    rel = _recarregar(tmp_path, NOME_RELATORIO)
    rel["importaveis"]["total"] = 2
    rel["importaveis"]["multipla_escolha"] = 2
    _escrever(tmp_path, NOME_RELATORIO, rel)
    v = verificacao.verificar(tmp_path)
    assert "quarentenado_importado" in regras(v)


def test_contagem_inflada_no_relatorio_reprova(tmp_path: Path) -> None:
    """Relatorio que afirma numero que os arquivos nao sustentam e falha."""
    escrever_base(tmp_path)
    rel = _recarregar(tmp_path, NOME_RELATORIO)
    rel["contagens"]["com_gabarito"] = 4
    _escrever(tmp_path, NOME_RELATORIO, rel)
    v = verificacao.verificar(tmp_path)
    assert "origem_nao_bate_com_gabarito" in regras(v)


def test_chave_ambigua_por_origem_gabarito_reprova(tmp_path: Path) -> None:
    """A nomenclatura antiga somava o total, nao os itens com letra: nao volta."""
    escrever_base(tmp_path)
    rel = _recarregar(tmp_path, NOME_RELATORIO)
    rel["contagens"]["por_origem_gabarito"] = {"bloco_gabarito": 3}
    _escrever(tmp_path, NOME_RELATORIO, rel)
    v = verificacao.verificar(tmp_path)
    assert "chave_ambigua_por_origem_gabarito" in regras(v)


def test_inventario_fora_do_total_reprova(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    inventario = _recarregar(tmp_path, NOME_INVENTARIO)
    inventario[0]["itens"] = 5
    _escrever(tmp_path, NOME_INVENTARIO, inventario)
    v = verificacao.verificar(tmp_path)
    assert "itens_nao_batem_com_total" in regras(v)


def test_relatorio_admite_sujeira_reprova(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    rel = _recarregar(tmp_path, NOME_RELATORIO)
    rel["todos_limpos"] = False
    _escrever(tmp_path, NOME_RELATORIO, rel)
    v = verificacao.verificar(tmp_path)
    assert "relatorio_admite_sujeira" in regras(v)


def test_limpeza_divergente_entre_relatorio_e_disco_reprova(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    rel = _recarregar(tmp_path, NOME_RELATORIO)
    rel["varredura"][NOME_RICO]["limpo"] = False
    _escrever(tmp_path, NOME_RELATORIO, rel)
    v = verificacao.verificar(tmp_path)
    assert "limpeza_divergente" in regras(v)


def test_relatorio_nao_pode_se_autodeclarar_limpo(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    rel = _recarregar(tmp_path, NOME_RELATORIO)
    rel["varredura"][NOME_RELATORIO] = {"limpo": True, "total": 0}
    _escrever(tmp_path, NOME_RELATORIO, rel)
    v = verificacao.verificar(tmp_path)
    assert "relatorio_se_autodeclara_limpo" in regras(v)


def test_cli_devolve_zero_no_conjunto_coerente(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    assert main(["verificar", "--dest", str(tmp_path)]) == 0


def test_cli_devolve_um_quando_ha_bloqueante(tmp_path: Path) -> None:
    escrever_base(tmp_path)
    linhas = _recarregar(tmp_path, NOME_IMPORT_CE)
    linhas[0]["enunciado"] = CPF_VALIDO + " " + linhas[0]["enunciado"]
    _escrever(tmp_path, NOME_IMPORT_CE, linhas)
    assert main(["verificar", "--dest", str(tmp_path)]) == 1


def test_cli_json_e_machine_readable_e_falha_lá_dentro(tmp_path: Path) -> None:
    import io
    from contextlib import redirect_stdout

    escrever_base(tmp_path)
    buffer = io.StringIO()
    with redirect_stdout(buffer):
        codigo = main(["verificar", "--dest", str(tmp_path), "--json"])
    assert codigo == 0
    saida = json.loads(buffer.getvalue())
    assert saida["ok"] is True
    assert saida["metricas"]["rico"] == 3
    assert len(saida["vistorias"]) == 7



