"""Fixtures de PDFs sinteticos gerados em runtime.

Item 2 do escopo:
- Usar APENAS PDFs sinteticos gerados em runtime (reportlab + pikepdf).
- Nunca processar apostilas reais; nada aqui toca banco ou storage.

Os geradores cobrem o que a sanitizacao precisa provar: metadados legados no
DocInfo, XMP legado, carimbo visual (page stream extra e Form XObject),
conteudo ativo (/JavaScript, /JS, /AA, /OpenAction, /Names/JavaScript), PDF
assinado, PDF criptografado e bytes malformados.
"""

from __future__ import annotations

import io
from typing import Dict, List, Optional

import pikepdf
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

__all__ = [
    "METADADOS_LEGADOS",
    "gerar_pdf_sintetico",
    "gerar_pdf_com_metadados_proibidos",
    "gerar_pdf_multipagina",
    "gerar_pdf_com_carimbo_visual",
    "gerar_pdf_com_xmp_legado",
    "gerar_pdf_com_conteudo_ativo",
    "gerar_pdf_openaction_seguro",
    "gerar_pdf_assinado_simulado",
    "gerar_pdf_criptografado",
    "gerar_pdf_malformado",
    "ler_metadados_pdf",
    "ler_docinfo",
    "listar_chaves_pdf",
    "possui_xmp",
]

#: Delimitadores de objeto PDF montados por codigo de byte, para que o fonte
#: nao precise de literais problematicos para ferramentas de texto/patch.
_ABERTURA = bytes((0x3C, 0x3C))
_FECHAMENTO = bytes((0x3E, 0x3E))

#: Rotulos explicitos: se qualquer um sobreviver ao sanitize, a auditoria falha.
METADADOS_LEGADOS: Dict[str, str] = {
    "author": "AUTOR-LEGADO",
    "creator": "CREATOR-LEGADO",
    "producer": "PRODUTOR-LEGADO",
    "owner": "DONO-LEGADO",
    "origem": "ORIGEM-LEGADA",
    "source": "SOURCE-LEGADO",
    "origin": "ORIGIN-LEGADO",
    "watermark": "MARCA-DAGUA-LEGADA",
    "marca_dagua": "MARCA-DAGUA-LEGADA",
    "technical_metadata": "TECNICO-LEGADO",
    "software": "SOFTWARE-LEGADO",
    "tool_chain": "TOOLCHAIN-LEGADO",
    "fingerprint": "FINGERPRINT-LEGADO",
    "title": "TITULO-LEGADO",
    "subject": "ASSUNTO-LEGADO",
    "keywords": "PALAVRAS-LEGADAS",
    "rights": "DIREITOS-LEGADOS",
}


def gerar_pdf_sintetico(
    texto: str = "Apostila sintetica de teste",
    metadados: Optional[Dict[str, str]] = None,
) -> bytes:
    """Gerar um PDF sintetico em memoria usando reportlab.

    Chaves padrao usam os setters do reportlab; as demais (incluindo as
    legadas) sao injetadas no dicionario /Info pela extensao do ``format``.
    """
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)

    if metadados:
        setters = {
            "author": pdf.setAuthor,
            "creator": pdf.setCreator,
            "producer": pdf.setProducer,
            "subject": pdf.setSubject,
            "title": pdf.setTitle,
            "keywords": pdf.setKeywords,
        }
        extras = {}
        for chave, valor in metadados.items():
            setter = setters.get(chave.lower())
            if setter is not None:
                setter(valor)
            else:
                extras[chave] = valor

        if extras:
            info = pdf._doc.info
            for chave, valor in extras.items():
                setattr(info, chave, valor)

            format_original = info.format

            def format_com_extras(document, _orig=format_original, _extras=extras):
                from reportlab.pdfbase.pdfdoc import PDFString

                base = _orig(document)
                extra_txt = "".join(
                    f"/{k} {PDFString(str(v)).format(document).decode('latin-1')} "
                    for k, v in _extras.items()
                ).encode("latin-1")
                return base.replace(_FECHAMENTO, extra_txt + _FECHAMENTO, 1)

            info.format = format_com_extras

    pdf.drawString(72, 720, texto)
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def gerar_pdf_com_metadados_proibidos() -> bytes:
    """Gerar um PDF sintetico com TODO o registro legado presente."""
    return gerar_pdf_sintetico(
        texto="Apostila sintetica com metadados legados",
        metadados=dict(METADADOS_LEGADOS),
    )


def _abrir(dados: bytes) -> pikepdf.Pdf:
    return pikepdf.Pdf.open(io.BytesIO(dados))


def _salvar(pdf: pikepdf.Pdf, **kwargs) -> bytes:
    buffer = io.BytesIO()
    pdf.save(buffer, **kwargs)
    return buffer.getvalue()


def gerar_pdf_com_carimbo_visual(texto: str = "CONTEUDO VISIVEL DA PAGINA") -> bytes:
    """PDF com carimbo de marca-d'agua VISUAL: dois page streams e um Form
    XObject. E a camada que a sanitizacao nunca pode tocar.
    """
    base = gerar_pdf_sintetico(texto=texto, metadados=dict(METADADOS_LEGADOS))
    pdf = _abrir(base)
    pagina = pdf.pages[0]
    obj = pagina.obj

    form = pdf.make_stream(
        b"q 0.80 0.80 0.80 rg 20 20 260 60 re f Q",
        extra_keys={
            "/Type": pikepdf.Name("/XObject"),
            "/Subtype": pikepdf.Name("/Form"),
            "/BBox": pikepdf.Array([0, 0, 280, 80]),
        },
    )

    recursos = obj.get("/Resources")
    if recursos is None:
        recursos = pdf.make_indirect(pikepdf.Dictionary())
        obj["/Resources"] = recursos
    xobjects = recursos.get("/XObject")
    if xobjects is None:
        xobjects = pdf.make_indirect(pikepdf.Dictionary())
        recursos["/XObject"] = xobjects
    xobjects["/CarimboVisual"] = form

    chamado = pdf.make_stream(b"q 1 0 0 1 60 120 cm /CarimboVisual Do Q")
    existente = obj.get("/Contents")
    if existente is None:
        obj["/Contents"] = pikepdf.Array([chamado])
    elif isinstance(existente, pikepdf.Array):
        novo = pikepdf.Array(list(existente))
        novo.append(chamado)
        obj["/Contents"] = novo
    else:
        obj["/Contents"] = pikepdf.Array([existente, chamado])

    saida = _salvar(pdf, fix_metadata_version=False)
    pdf.close()
    return saida


def gerar_pdf_com_xmp_legado() -> bytes:
    """PDF com stream XMP carregando tecnica, autoria e identificacao legadas."""
    base = gerar_pdf_sintetico(texto="Apostila com XMP legado")
    pdf = _abrir(base)
    with pdf.open_metadata(set_pikepdf_as_editor=False, update_docinfo=False) as meta:
        meta["xmp:CreatorTool"] = "FERRAMENTA-LEGADA 1.2.3"
        meta["xmp:CreateDate"] = "2020-01-01T00:00:00Z"
        meta["pdf:Producer"] = "PRODUTOR-XMP-LEGADO"
        meta["dc:creator"] = ["AUTOR-XMP-LEGADO"]
        meta["dc:title"] = "TITULO-XMP-LEGADO"
        meta["dc:description"] = "ASSUNTO-XMP-LEGADO"
        meta["pdf:Keywords"] = "PALAVRAS-XMP-LEGADAS"
    saida = _salvar(pdf, fix_metadata_version=False)
    pdf.close()
    return saida


def _acao_javascript(pdf: pikepdf.Pdf, codigo: str) -> pikepdf.Dictionary:
    acao = pdf.make_indirect(pikepdf.Dictionary())
    acao["/S"] = pikepdf.Name("/JavaScript")
    acao["/JS"] = pikepdf.String(codigo)
    return acao


def gerar_pdf_com_conteudo_ativo() -> bytes:
    """PDF com scripts/acoes em catalogo, pagina e anotacao."""
    base = gerar_pdf_sintetico(
        texto="Apostila com conteudo ativo", metadados=dict(METADADOS_LEGADOS)
    )
    pdf = _abrir(base)

    pdf.Root["/JavaScript"] = pikepdf.String("alerta-de-catalogo")
    pdf.Root["/AA"] = pdf.make_indirect(pikepdf.Dictionary())
    pdf.Root["/AA"]["/O"] = _acao_javascript(pdf, "nao-executar")

    nomes = pdf.make_indirect(pikepdf.Dictionary())
    dicionario = pdf.make_indirect(pikepdf.Dictionary())
    dicionario["/ScriptAtivo"] = _acao_javascript(pdf, "nomes-javascript")
    nomes["/JavaScript"] = dicionario
    pdf.Root["/Names"] = nomes

    pagina = pdf.pages[0]
    pagina.obj["/OpenAction"] = pdf.make_indirect(pikepdf.Dictionary())
    pagina.obj["/OpenAction"]["/S"] = pikepdf.Name("/JavaScript")
    pagina.obj["/OpenAction"]["/JS"] = pikepdf.String("acao-de-pagina")

    acao_launch = pdf.make_indirect(pikepdf.Dictionary())
    acao_launch["/S"] = pikepdf.Name("/Launch")
    acao_launch["/F"] = pikepdf.String("malicioso.exe")
    anotacao = pdf.make_indirect(pikepdf.Dictionary())
    anotacao["/Type"] = pikepdf.Name("/Annot")
    anotacao["/Subtype"] = pikepdf.Name("/Widget")
    anotacao["/Rect"] = pikepdf.Array([0, 0, 10, 10])
    anotacao["/A"] = acao_launch
    anotacao["/AA"] = pdf.make_indirect(pikepdf.Dictionary())
    anotacao["/AA"]["/E"] = _acao_javascript(pdf, "ao-entrar")
    pagina.obj["/Annots"] = pikepdf.Array([anotacao])
    acroform = pdf.make_indirect(pikepdf.Dictionary())
    acroform["/Fields"] = pikepdf.Array([anotacao])
    pdf.Root["/AcroForm"] = acroform

    saida = _salvar(pdf, fix_metadata_version=False)
    pdf.close()
    return saida


def gerar_pdf_openaction_seguro() -> bytes:
    """PDF cujo /OpenAction apenas navega (/GoTo): deve ser PRESERVADO."""
    base = gerar_pdf_sintetico(texto="Apostila com OpenAction de navegacao")
    pdf = _abrir(base)
    acao = pdf.make_indirect(pikepdf.Dictionary())
    acao["/S"] = pikepdf.Name("/GoTo")
    acao["/D"] = pikepdf.Array([pdf.pages[0].obj, pikepdf.Name("/Fit")])
    pdf.Root["/OpenAction"] = pikepdf.Array([pdf.pages[0].obj, acao])
    saida = _salvar(pdf, fix_metadata_version=False)
    pdf.close()
    return saida


def gerar_pdf_assinado_simulado() -> bytes:
    """PDF com estrutura de assinatura digital (sinalizacao heuristica).

    Nao e uma assinatura criptograficamente valida; reproduz os marcadores
    que justificam o bloqueio: /Sig com /ByteRange, campo /FT=/Sig e
    /AcroForm/SigFlags.
    """
    base = gerar_pdf_sintetico(texto="Apostila assinada")
    pdf = _abrir(base)

    assinatura = pdf.make_indirect(pikepdf.Dictionary())
    assinatura["/Type"] = pikepdf.Name("/Sig")
    assinatura["/ByteRange"] = pikepdf.Array([0, 100, 260, 40])
    assinatura["/Name"] = pikepdf.String("ASSINANTE-LEGADO")

    campo = pdf.make_indirect(pikepdf.Dictionary())
    campo["/Type"] = pikepdf.Name("/Annot")
    campo["/Subtype"] = pikepdf.Name("/Widget")
    campo["/FT"] = pikepdf.Name("/Sig")
    campo["/V"] = assinatura
    campo["/T"] = pikepdf.String("AssinaturaDigital")
    campo["/Rect"] = pikepdf.Array([0, 0, 120, 40])

    acroform = pdf.make_indirect(pikepdf.Dictionary())
    acroform["/Fields"] = pikepdf.Array([campo])
    acroform["/SigFlags"] = 3
    pdf.Root["/AcroForm"] = acroform

    saida = _salvar(pdf, fix_metadata_version=False)
    pdf.close()
    return saida


def gerar_pdf_criptografado() -> bytes:
    """PDF criptografado com senha de usuario: deve ser bloqueado."""
    base = gerar_pdf_sintetico(texto="Apostila criptografada")
    pdf = _abrir(base)
    saida = _salvar(
        pdf,
        encryption=pikepdf.Encryption(owner="senha-teste", user="senha-teste", R=4),
        fix_metadata_version=False,
    )
    pdf.close()
    return saida


def gerar_pdf_malformado() -> bytes:
    """Bytes com cabecalho %PDF, xref ausente e corpo quebrado: bloqueado."""
    return (
        b"%PDF-1.7\n1 0 obj\n"
        + _ABERTURA
        + b" /Type /Catalog /Pages 2 0 R "
        + _FECHAMENTO
        + b"\nendobj\ntrailer\n"
        + _ABERTURA
        + b" /Root 1 0 R /Prev 9999999 "
        + _FECHAMENTO
        + b"\nstartxref\n9999999\n%%EOF\n"
        + b"objeto corrompido sem numero definido\n"
    )


# ---------------------------------------------------------------------------
# Leitura para assercoes
# ---------------------------------------------------------------------------
def ler_metadados_pdf(pdf_bytes: bytes) -> Dict[str, str]:
    """Ler pares ``/chave (valor)`` dos bytes por regex (API historica)."""
    import re

    metadados: Dict[str, str] = {}
    for chave, valor in re.findall(rb"/(\w+)\s*\(([^)]*)\)", pdf_bytes):
        metadados[chave.decode("latin-1").lower()] = valor.decode("latin-1")
    return metadados


def ler_docinfo(pdf_bytes: bytes) -> Dict[str, str]:
    """Ler o dicionario /Info real com pikepdf."""
    pdf = _abrir(pdf_bytes)
    try:
        info = pdf.trailer.get("/Info")
        if info is None:
            return {}
        return {str(k).lstrip("/"): str(v) for k, v in info.items()}
    finally:
        pdf.close()


def listar_chaves_pdf(pdf_bytes: bytes) -> List[str]:
    """Chaves de /Info presentes, sem barra e em minusculas."""
    return sorted(k.lower() for k in ler_docinfo(pdf_bytes))


def possui_xmp(pdf_bytes: bytes) -> bool:
    """True se o PDF ainda carrega um stream XMP (/Root/Metadata)."""
    pdf = _abrir(pdf_bytes)
    try:
        return pdf.Root.get("/Metadata") is not None
    finally:
        pdf.close()

def gerar_pdf_multipagina(paginas: int = 3, metadados: Optional[Dict[str, str]] = None) -> bytes:
    """PDF sintetico de varias paginas com /Info legado injetado por pikepdf.

    Base das assercoes de preservacao de contagem de paginas e de MediaBox por
    pagina depois da sanitizacao.
    """
    buffer = io.BytesIO()
    desenho = canvas.Canvas(buffer, pagesize=A4)
    for indice in range(paginas):
        desenho.drawString(72, 720, "PAGINA " + str(indice + 1) + " DE " + str(paginas))
        desenho.showPage()
    desenho.save()
    pdf = _abrir(buffer.getvalue())
    info = pdf.make_indirect(pikepdf.Dictionary())
    for chave, valor in (metadados if metadados is not None else METADADOS_LEGADOS).items():
        info["/" + chave] = pikepdf.String(valor)
    pdf.trailer["/Info"] = info
    saida = _salvar(pdf, fix_metadata_version=False)
    pdf.close()
    return saida
