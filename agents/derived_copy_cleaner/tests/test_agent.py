"""Testes obrigatorios do agente ``derived_copy_cleaner``.

Cobrem os itens 1 a 10 do escopo e a decisao de arquitetura de 2026-10-11
(sanitizacao **completa** do registro interno legado da copia derivada, com a
camada visual intocada). Usam APENAS PDFs sinteticos gerados em runtime com
reportlab/pikepdf (item 2) - nunca apostilas reais, banco ou storage.
"""

from __future__ import annotations

import hashlib
import io

import pikepdf
import pytest

from agents.derived_copy_cleaner import policy
from agents.derived_copy_cleaner.agent import (
    DerivedCopyCleaner,
    DerivedCopyError,
    carregar_config,
    limpar_copia_derivada,
)
from agents.derived_copy_cleaner.icon_policy import (
    claims_do_icone,
    icone_sugere_autoria,
)
from agents.derived_copy_cleaner.metadata_cleaner import (
    CHAVES_PRESERVADAS,
    CHAVES_TECNICAS_PROIBIDAS,
    ErroSanitizacaoPdf,
    limpar_metadados,
    limpar_metadados_pdf,
    sanitizar_pdf_com_relatorio,
)
from agents.derived_copy_cleaner.pdf_engine import (
    PdfAssinadoBloqueado,
    PdfCriptografadoBloqueado,
    PdfMalformadoBloqueado,
    RelatorioSanitizacao,
    ValidacaoSaidaBloqueada,
    sanitizar_pdf,
)
from agents.derived_copy_cleaner.sanitizer_stripper import (
    remover_sanitizacao_e_marca,
)
from agents.derived_copy_cleaner.synthetic_pdf_fixtures import (
    METADADOS_LEGADOS,
    gerar_pdf_assinado_simulado,
    gerar_pdf_com_carimbo_visual,
    gerar_pdf_com_conteudo_ativo,
    gerar_pdf_com_metadados_proibidos,
    gerar_pdf_com_xmp_legado,
    gerar_pdf_criptografado,
    gerar_pdf_malformado,
    gerar_pdf_multipagina,
    gerar_pdf_openaction_seguro,
    gerar_pdf_sintetico,
    ler_docinfo,
    ler_metadados_pdf,
    listar_chaves_pdf,
    possui_xmp,
)


# ---------------------------------------------------------------------------
# Auxiliares de inspecao
# ---------------------------------------------------------------------------
def _abrir(pdf_bytes: bytes):
    return pikepdf.Pdf.open(io.BytesIO(pdf_bytes))


def _assinatura_visual(pdf_bytes: bytes):
    """Estado visual por pagina: page streams, MediaBox e Form XObjects."""
    pdf = _abrir(pdf_bytes)
    streams = []
    medias = []
    xobjects = []
    rotates = []
    for pagina in pdf.pages:
        obj = pagina.obj
        conteudo = obj.get("/Contents")
        if conteudo is None:
            itens = []
        elif isinstance(conteudo, pikepdf.Array):
            itens = [stream.read_bytes() for stream in conteudo]
        else:
            itens = [conteudo.read_bytes()]
        streams.append([hashlib.sha256(item).hexdigest() for item in itens])
        medias.append(tuple(float(v) for v in pagina.mediabox))
        inventario = {}
        recursos = obj.get("/Resources")
        if recursos is not None:
            dicionario = recursos.get("/XObject")
            if dicionario is not None:
                for nome in sorted(dicionario.keys()):
                    sub = dicionario[nome]
                    inventario[str(nome)] = (
                        str(sub.get("/Subtype")),
                        tuple(float(v) for v in sub.get("/BBox") or []),
                        hashlib.sha256(sub.read_bytes()).hexdigest(),
                    )
        xobjects.append(inventario)
        rotates.append(str(obj.get("/Rotate") or "0"))
    resultado = {
        "paginas": len(streams),
        "streams": streams,
        "mediabox": medias,
        "xobjects": xobjects,
        "rotate": rotates,
    }
    pdf.close()
    return resultado


def _chaves_de_acao(pdf_bytes: bytes):
    """Chaves/acoes que executam codigo ainda presentes em qualquer objeto."""
    pdf = _abrir(pdf_bytes)
    perigosos = set()
    for obj in pdf.objects:
        if isinstance(obj, (pikepdf.Dictionary, pikepdf.Stream)):
            for chave in ("/JavaScript", "/JS", "/AA"):
                if obj.get(chave) is not None:
                    perigosos.add(str(chave))
            tipo = obj.get("/S")
            if tipo is not None and str(tipo) in policy.ACOES_AUTOMATICAS_PERIGOSAS:
                perigosos.add(str(tipo))
    pdf.close()
    return perigosos


def _tem_info(pdf_bytes: bytes):
    pdf = _abrir(pdf_bytes)
    try:
        return pdf.trailer.get("/Info") is not None
    finally:
        pdf.close()


def _textos(pdf_bytes: bytes):
    pdfium = pytest.importorskip("pypdfium2")
    documento = pdfium.PdfDocument(pdf_bytes)
    try:
        return [
            documento[indice].get_textpage().get_text_bounded()
            for indice in range(len(documento))
        ]
    finally:
        documento.close()


# ---------------------------------------------------------------------------
# 7.1 test_apenas_copia_derivada (espera ValueError)
# ---------------------------------------------------------------------------
def test_apenas_copia_derivada():
    """Nunca aplicar em originais: deve levantar ValueError."""
    with pytest.raises(ValueError):
        remover_sanitizacao_e_marca({"sanitizado": True}, target="original")

    with pytest.raises(ValueError):
        DerivedCopyCleaner(target="original")

    with pytest.raises(ValueError):
        limpar_copia_derivada({"metadados": {}}, target="fonte")

    resultado = limpar_copia_derivada({"metadados": {}}, target="copia_derivada")
    assert resultado["target"] == "copia_derivada"


# ---------------------------------------------------------------------------
# 7.2 test_remove_sanitizacao_e_marca
# ---------------------------------------------------------------------------
def test_remove_sanitizacao_e_marca():
    """Deve remover sanitização e marca de uma cópia derivada."""
    documento = {
        "sanitizado": True,
        "marca": "MARCA-X",
        "branding": "logo",
        "conteudo": "texto",
    }
    limpo = remover_sanitizacao_e_marca(documento, target="copia_derivada")

    assert "sanitizado" not in limpo
    assert "marca" not in limpo
    assert "branding" not in limpo
    assert limpo["sanitizacao_removida"] is True
    assert limpo["marca_removida"] is True
    assert limpo["conteudo"] == "texto"


# ---------------------------------------------------------------------------
# 7.3 test_limpa_metadados (politica completa; conservadora segue enderecavel)
# ---------------------------------------------------------------------------
def test_limpa_metadados():
    """A copia derivada intermediaria fica sem NENHUM registro legado."""
    metadados = {
        "watermark": "WM",
        "marca_dagua": "WM",
        "technical_metadata": "meta",
        "software": "soft",
        "tool_chain": "chain",
        "fingerprint": "fp",
        "author": "Fulano",
        "creator": "Ferramenta",
        "producer": "Produtor",
        "owner": "Dono",
        "origem": "origem",
        "source": "source",
        "origin": "origin",
        "titulo": "Apostila",
    }
    limpos = limpar_metadados(metadados)

    assert limpos == {}
    for chave in CHAVES_TECNICAS_PROIBIDAS:
        assert chave not in limpos
    for chave in policy.CHAVES_AUTORIA_LEGADA:
        assert chave not in limpos
    assert "titulo" not in limpos

    # A politica conservadora continua viva e documenta a inversao.
    conservados = limpar_metadados(metadados, policy.POLITICA_CONSERVADORA)
    assert conservados.get("author") == "Fulano"
    assert conservados.get("producer") == "Produtor"
    assert conservados.get("origem") == "origem"
    assert conservados.get("titulo") == "Apostila"
    assert conservados.get("watermark") == "WM"
    assert "software" not in conservados
    assert "fingerprint" not in conservados


# ---------------------------------------------------------------------------
# 7.4 test_icone_nao_sugere_autoria
# ---------------------------------------------------------------------------
def test_icone_nao_sugere_autoria():
    """O ícone é apenas identificador; nunca sugere autoria/endosso."""
    claims = claims_do_icone()
    assert claims == {
        "authorship": False,
        "endorsement": False,
        "origin_of_content": False,
    }

    assert icone_sugere_autoria("Ferramenta: deepseek") is False
    assert icone_sugere_autoria("criado pela deepseek") is True
    assert icone_sugere_autoria("endossado pela deepseek") is True

    with pytest.raises(ValueError):
        limpar_copia_derivada(
            {"metadados": {}, "texto_icone": "criado pela deepseek"},
            target="copia_derivada",
        )


# ---------------------------------------------------------------------------
# 7.5 test_pdf_sintetico_gerado
# ---------------------------------------------------------------------------
def test_pdf_sintetico_gerado():
    """Deve gerar PDFs sintéticos em runtime (nunca reais)."""
    pdf_bytes = gerar_pdf_sintetico(texto="Apostila sintetica")
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF")
    assert bool(pdf_bytes)

    pdf_proibido = gerar_pdf_com_metadados_proibidos()
    assert pdf_proibido.startswith(b"%PDF")

    metadados = ler_metadados_pdf(pdf_proibido)
    assert any(chave in metadados for chave in ("author", "creator", "producer"))


# ---------------------------------------------------------------------------
# 7.6 test_limpa_metadados_pdf_real (agora expurgo completo)
# ---------------------------------------------------------------------------
def test_limpa_metadados_pdf_real():
    """A limpeza opera nos BYTES reais e expurga tambem autoria/procedencia."""
    pdf = gerar_pdf_com_metadados_proibidos()
    antes = ler_metadados_pdf(pdf)

    assert "watermark" in antes
    assert "software" in antes
    assert "author" in antes  # pre-condicao: a autoria legada esta no PDF real

    limpo = limpar_metadados_pdf(pdf)
    assert isinstance(limpo, bytes)
    assert limpo.startswith(b"%PDF")
    assert limpo != pdf

    depois = ler_metadados_pdf(limpo)
    for chave in CHAVES_TECNICAS_PROIBIDAS:
        assert chave not in depois, "metadado tecnico ainda presente: " + chave
    for chave in policy.CHAVES_AUTORIA_LEGADA:
        assert chave not in depois, "autoria/procedencia legada ainda presente: " + chave

    assert listar_chaves_pdf(limpo) == []
    assert _tem_info(limpo) is False
    for rotulo in ("AUTOR-LEGADO", "PRODUTOR-LEGADO", "MARCA-DAGUA-LEGADA", "SOFTWARE-LEGADO"):
        assert rotulo.encode("latin-1") not in limpo

    agente = DerivedCopyCleaner(target="copia_derivada")
    assert agente.limpar_pdf(pdf).startswith(b"%PDF")


# ---------------------------------------------------------------------------
# 7.7 test_limpar_metadados_pdf_rejeita_entrada_invalida
# ---------------------------------------------------------------------------
def test_limpar_metadados_pdf_rejeita_entrada_invalida():
    """Deve recusar entradas que nao sejam bytes de PDF legivel."""
    with pytest.raises(TypeError):
        limpar_metadados_pdf({"author": "x"})  # type: ignore[arg-type]

    with pytest.raises(ValueError):
        limpar_metadados_pdf(b"nao e um pdf")

    with pytest.raises(ValueError):
        limpar_metadados_pdf(gerar_pdf_malformado())


# ---------------------------------------------------------------------------
# Sanitizacao completa: cada chave legada some dos bytes reais
# ---------------------------------------------------------------------------
def test_expurgo_de_todas_as_chaves_legadas_em_bytes_reais():
    dados = gerar_pdf_multipagina(3)
    antes = listar_chaves_pdf(dados)
    for chave in ("author", "producer", "owner", "origem", "source", "origin",
                  "watermark", "software", "tool_chain", "fingerprint",
                  "technical_metadata", "title"):
        assert chave in antes, "fixture sem a chave legada: " + chave

    saida, relatorio = sanitizar_pdf(dados)

    assert listar_chaves_pdf(saida) == []
    assert _tem_info(saida) is False
    presentes = {item["chave"].lstrip("/").lower() for item in relatorio.docinfo_removido}
    esperadas = {policy.normalizar_chave(chave) for chave in METADADOS_LEGADOS}
    assert esperadas <= presentes
    for chave, valor in METADADOS_LEGADOS.items():
        if chave in presentes:
            assert valor.encode("latin-1") not in saida


# ---------------------------------------------------------------------------
# Relatorio de auditoria
# ---------------------------------------------------------------------------
def test_relatorio_de_auditoria_enumera_o_que_sai_para_reinsercao():
    dados = gerar_pdf_com_metadados_proibidos()
    saida, relatorio = sanitizar_pdf(dados)

    assert isinstance(relatorio, RelatorioSanitizacao)
    registro = relatorio.to_dict()
    assert registro["politica"] == policy.POLITICA_COMPLETA
    assert registro["paginas"] == 1

    removidas = {item["chave"].lstrip("/").lower(): item for item in registro["docinfo_removido"]}
    assert removidas["author"]["valor"] == "AUTOR-LEGADO"
    assert removidas["producer"]["valor"] == "PRODUTOR-LEGADO"
    assert removidas["watermark"]["motivo"] == "DocInfo em limpeza completa"

    reencher = registro["metadados_a_reinserir"]
    assert reencher["author"] == "AUTOR-LEGADO"
    assert reencher["origem"] == "ORIGEM-LEGADA"
    assert relatorio.metadados_a_reinserir["producer"] == "PRODUTOR-LEGADO"
    assert registro["id_removido"] is True
    assert registro["validacao"]["page_streams_iguais"] is True

    ditos, relatorio_dito = sanitizar_pdf_com_relatorio(dados)
    assert ditos.startswith(b"%PDF")
    assert relatorio_dito["politica"] == policy.POLITICA_COMPLETA


# ---------------------------------------------------------------------------
# XMP legado
# ---------------------------------------------------------------------------
def test_xmp_legado_removido_dos_bytes():
    dados = gerar_pdf_com_xmp_legado()
    assert possui_xmp(dados) is True
    assert b"xpacket" in dados

    saida, relatorio = sanitizar_pdf(dados)

    assert relatorio.xmp_stream_removido is True
    assert relatorio.xmp_bytes_antes != 0
    assert possui_xmp(saida) is False
    assert b"xpacket" not in saida
    for rotulo in (b"FERRAMENTA-LEGADA", b"PRODUTOR-XMP-LEGADO", b"AUTOR-XMP-LEGADO"):
        assert rotulo not in saida


def test_politica_conservadora_preserva_autoria_e_expurga_tecnico():
    dados = gerar_pdf_com_xmp_legado()

    saida, relatorio = sanitizar_pdf(dados, politica=policy.POLITICA_CONSERVADORA)

    assert relatorio.politica == policy.POLITICA_CONSERVADORA
    assert relatorio.xmp_stream_removido is False
    assert any("CreatorTool" in no for no in relatorio.xmp_nos_removidos)
    assert b"FERRAMENTA-LEGADA" not in saida
    assert b"AUTOR-XMP-LEGADO" in saida
    assert relatorio.docinfo_removido == []
    assert "/Producer" in relatorio.docinfo_preservado


# ---------------------------------------------------------------------------
# Conteudo ativo
# ---------------------------------------------------------------------------
def test_conteudo_ativo_neutralizado():
    dados = gerar_pdf_com_conteudo_ativo()
    visual_antes = _assinatura_visual(dados)
    assert _chaves_de_acao(dados) != set()

    saida, relatorio = sanitizar_pdf(dados)

    for marcador in ("/Root/JavaScript", "/Root/AA", "/Root/Names/JavaScript",
                     "/Page/OpenAction", "/A[/Launch]", "/Obj/JS"):
        assert marcador in relatorio.acoes_neutralizadas, "acao nao neutralizada: " + marcador
    assert relatorio.acoes_remanescentes == []
    assert _chaves_de_acao(saida) == set()
    assert relatorio.validacao["sem_acoes_perigosas"] is True
    assert relatorio.validacao["names_javascript_ausente"] is True
    assert relatorio.validacao["page_streams_iguais"] is True
    assert _assinatura_visual(saida) == visual_antes
    assert b"malicioso" not in saida


def test_openaction_de_navegacao_e_preservado():
    dados = gerar_pdf_openaction_seguro()

    saida, relatorio = sanitizar_pdf(dados)

    assert relatorio.openaction_preservado is True
    assert relatorio.acoes_remanescentes == []

    pdf = _abrir(saida)
    try:
        openaction = pdf.Root.get("/OpenAction")
        assert openaction is not None
        assert str(openaction[-1].get("/S")) == "/GoTo"
    finally:
        pdf.close()

    # O mesmo motor remove OpenAction perigosa (coberto no caso ativo acima).
    _, relatorio_ativo = sanitizar_pdf(gerar_pdf_com_conteudo_ativo())
    assert relatorio_ativo.openaction_preservado is False


# ---------------------------------------------------------------------------
# Camada visual
# ---------------------------------------------------------------------------
def test_carimbo_visual_e_form_xobject_preservados():
    dados = gerar_pdf_com_carimbo_visual()
    antes = _assinatura_visual(dados)

    assert len(antes["streams"][0]) == 2
    assert any("CarimboVisual" in nome for nome in antes["xobjects"][0])

    saida, relatorio = sanitizar_pdf(dados)
    depois = _assinatura_visual(saida)

    assert depois == antes
    assert relatorio.validacao["xobjects_iguais"] is True
    assert relatorio.validacao["mediabox_iguais"] is True
    assert relatorio.validacao["rotate_igual"] is True


def test_paginas_e_geometria_preservadas():
    dados = gerar_pdf_multipagina(3)
    antes = _assinatura_visual(dados)
    assert antes["paginas"] == 3

    saida, relatorio = sanitizar_pdf(dados)
    depois = _assinatura_visual(saida)

    assert relatorio.paginas == 3
    assert depois["paginas"] == antes["paginas"]
    assert depois["mediabox"] == antes["mediabox"]
    assert depois["streams"] == antes["streams"]


def test_texto_renderizado_preservado_e_saida_reabre():
    dados = gerar_pdf_com_metadados_proibidos()

    saida, relatorio = sanitizar_pdf(dados)

    assert saida.startswith(b"%PDF")
    assert relatorio.validacao["cabecalho_pdf"] is True
    assert relatorio.validacao["reabre"] is True
    assert relatorio.validacao["texto_igual"] is True
    assert _textos(saida) == _textos(dados)
    assert _textos(saida) == ["Apostila sintetica com metadados legados"]


# ---------------------------------------------------------------------------
# Falha fechada
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "gerador, esperada",
    [
        (gerar_pdf_criptografado, PdfCriptografadoBloqueado),
        (gerar_pdf_assinado_simulado, PdfAssinadoBloqueado),
        (gerar_pdf_malformado, PdfMalformadoBloqueado),
    ],
)
def test_falha_fechada_nada_escreve(gerador, esperada):
    """Criptografado, assinado ou malformado: ValueError e nenhuma saida."""
    dados = gerador()
    with pytest.raises(ValueError) as info:
        sanitizar_pdf(dados)
    assert isinstance(info.value, esperada)
    assert isinstance(info.value, ErroSanitizacaoPdf)


def test_pdf_assinado_bloqueado_com_marcadores_no_erro():
    """A guarda de saida e um ValueError, e o assinado lista os marcadores."""
    assert issubclass(ValidacaoSaidaBloqueada, ValueError)

    dados = gerar_pdf_assinado_simulado()
    with pytest.raises(ValueError) as info:
        sanitizar_pdf_com_relatorio(dados)
    mensagem = str(info.value)
    assert "AcroForm" in mensagem or "Sig" in mensagem
    assert isinstance(info.value, PdfAssinadoBloqueado)


# ---------------------------------------------------------------------------
# Entrada imutavel
# ---------------------------------------------------------------------------
def test_entrada_nao_e_mutada():
    dados = bytearray(gerar_pdf_com_metadados_proibidos())
    referencia = bytes(dados)
    sha = hashlib.sha256(referencia).hexdigest()

    saida, relatorio = sanitizar_pdf(dados)

    assert bytes(dados) == referencia
    assert hashlib.sha256(dados).hexdigest() == sha
    assert relatorio.sha256_entrada == sha
    assert relatorio.sha256_saida == hashlib.sha256(saida).hexdigest()
    assert relatorio.validacao["entrada_imutavel"] is True
    assert saida != referencia


# ---------------------------------------------------------------------------
# Marca DeepSeek
# ---------------------------------------------------------------------------
def test_marca_deepseek_desativada_por_padrao():
    dados = gerar_pdf_com_carimbo_visual()
    antes = _assinatura_visual(dados)

    saida, relatorio = sanitizar_pdf(dados)

    assert relatorio.marca_deepseek["aplicado"] is False
    assert b"DeepSeek" not in saida
    assert _assinatura_visual(saida) == antes

    config = carregar_config()
    assert config["marca_deepseek"]["ativado"] is False
    assert config["marca_deepseek"]["modo"] == "proveniencia"

    limpo = limpar_copia_derivada(
        {"metadados": dict(METADADOS_LEGADOS)}, target="copia_derivada"
    )
    assert limpo["marca_visual_aplicada"] is False


def test_marca_de_proveniencia_explicita_e_additive_e_nunca_visual():
    dados = gerar_pdf_com_carimbo_visual()
    antes = _assinatura_visual(dados)

    saida, relatorio = sanitizar_pdf(
        dados,
        {"marca_deepseek": {"ativado": True, "modo": "proveniencia", "texto": "DeepSeek"}},
    )

    assert relatorio.marca_deepseek["aplicado"] is True
    assert _assinatura_visual(saida) == antes
    assert ler_docinfo(saida).get("Producer") == "DeepSeek"

    _, recusada = sanitizar_pdf(
        dados, {"marca_deepseek": {"ativado": True, "modo": "visual", "texto": "X"}}
    )
    assert recusada.marca_deepseek["aplicado"] is False


# ---------------------------------------------------------------------------
# Config, agente e decisao de politica
# ---------------------------------------------------------------------------
def test_config_yaml_descreve_as_duas_politicas():
    config = carregar_config()
    assert config["politica"] == policy.POLITICA_COMPLETA
    assert policy.POLITICA_CONSERVADORA in config["politicas_disponiveis"]
    assert config["visual"]["preservar_page_streams"] is True
    assert config["visual"]["preservar_xobjects"] is True
    assert config["metadata"]["wipe_docinfo"] is True
    assert config["metadata"]["remove_xmp"] is True
    assert config["metadata"]["remover_autoria_legada"] is True
    assert config["active_content"]["remover_javascript"] is True
    assert config["active_content"]["remover_names_javascript"] is True
    assert config["metadata"]["chaves_preservadas"] == []
    for chave in policy.CHAVES_AUTORIA_LEGADA:
        assert chave in config["metadata"]["chaves_autoria_legada"]


def test_agente_expoe_relatorio_de_sanitizacao():
    agente = DerivedCopyCleaner(target="copia_derivada")
    resultado = agente.sanitizar_pdf(gerar_pdf_com_metadados_proibidos())

    assert resultado["pdf"].startswith(b"%PDF")
    assert resultado["relatorio"]["politica"] == policy.POLITICA_COMPLETA
    assert resultado["relatorio"]["docinfo_removido"]
    assert agente.ultimo_relatorio["validacao"]["page_streams_iguais"] is True
    assert agente.politica == policy.POLITICA_COMPLETA

    conservador = DerivedCopyCleaner(target="copia_derivada",
                                     politica=policy.POLITICA_CONSERVADORA)
    assert conservador.politica == policy.POLITICA_CONSERVADORA

    with pytest.raises(ValueError):
        DerivedCopyCleaner(target="original")
    assert issubclass(DerivedCopyError, ValueError)
    assert issubclass(ErroSanitizacaoPdf, ValueError)


def test_agente_guarda_o_registro_para_reinsercao_consolidada():
    documento = {
        "sanitizado": True,
        "marca": "MARCA-ANTIGA",
        "metadados": dict(METADADOS_LEGADOS),
    }

    resultado = limpar_copia_derivada(documento, target="copia_derivada")

    assert resultado["documento"]["metadados"] == {}
    assert set(resultado["metadados_preservados"]) == set()
    registro = {item["chave"]: item["valor"] for item in resultado["registro_removido"]}
    assert registro["author"] == "AUTOR-LEGADO"
    assert registro["producer"] == "PRODUTOR-LEGADO"
    assert resultado["politica"] == policy.POLITICA_COMPLETA
    assert resultado["claims"] == {
        "authorship": False,
        "endorsement": False,
        "origin_of_content": False,
    }


def test_inversao_de_politica_fica_documentada():
    """A preservacao migrou das chaves de metadado para a camada visual."""
    assert CHAVES_PRESERVADAS == ()

    resumo = policy.resumo_politica()
    assert resumo["politica_ativa"] == policy.POLITICA_COMPLETA
    assert resumo["camada_visual_intacta"] is True
    assert resumo["docinfo"] == "wipe_total"
    assert resumo["xmp"] == "stream_removido"
    assert "author" in resumo["chaves_autoria_removidas"]
    assert resumo["chaves_autoria_preservadas"] == []
    assert "page_streams" in resumo["camadas_preservadas"]
    assert "carimbos_visiveis_de_marca_dagua" in resumo["camadas_preservadas"]

    conservado = policy.resumo_politica(policy.POLITICA_CONSERVADORA)
    assert conservado["docinfo"] == "wipe_por_chave"
    assert conservado["chaves_autoria_preservadas"]
    assert "author" in conservado["chaves_autoria_preservadas"]

    with pytest.raises(ValueError):
        policy.normalizar_politica("politica-inexistente")