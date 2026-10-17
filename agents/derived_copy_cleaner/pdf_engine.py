"""Motor de sanitizacao de PDF (pikepdf) para copias derivadas.

Unico modulo que toca bytes de PDF. Tres invariantes:

1. **Camada visual intocada** - page streams, imagens, XObjects/Form
   XObjects, texto renderizado, rotacao e geometria de pagina permanecem
   identicos. A saida so e entregue se hash por page stream, MediaBox,
   inventario de XObject e texto extraido (pypdfium2) baterem com a entrada.
2. **Metadados legados expurgados** conforme a politica do modulo
   ``policy``: na ``POLITICA_COMPLETA`` o ``/Info`` inteiro e o stream XMP
   vao embora; cada valor removido vai para o relatorio de auditoria para
   posterior reinsercao consolidada pelo operador.
3. **Conteudo ativo neutralizado** - ``/JavaScript``, ``/JS``, ``/AA``,
   ``/Names/JavaScript`` e ``/OpenAction`` de acao perigosa saem;
   navegacao interna ``/GoTo`` e preservada.

Falha fechada: documento criptografado, assinado/protegido ou malformado
aborta antes de qualquer escrita, com excecao subclass de ``ValueError``.
A deteccao de assinatura e **estrutural/heuristica**: procura
``/Sig``+``/ByteRange``, ``/AcroForm/SigFlags``, campos ``/FT=/Sig``,
``/XFA`` e ``/Perms``; nao verifica a criptografia da assinatura.

A entrada nunca e mutada: lemos de um ``io.BytesIO`` proprio e o SHA-256
do buffer recebido e conferido no fim.
"""

from __future__ import annotations

import hashlib
import io
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import pikepdf
from lxml import etree

from . import policy

__all__ = [
    "ErroSanitizacaoPdf",
    "PdfCriptografadoBloqueado",
    "PdfAssinadoBloqueado",
    "PdfMalformadoBloqueado",
    "ValidacaoSaidaBloqueada",
    "RelatorioSanitizacao",
    "sanitizar_pdf",
    "politica_vigente",
]


class ErroSanitizacaoPdf(ValueError):
    """Base de toda falha fechada do sanitizador (compativel com ValueError)."""


class PdfCriptografadoBloqueado(ErroSanitizacaoPdf):
    """PDF criptografado: nenhuma reescrita e tentada."""


class PdfAssinadoBloqueado(ErroSanitizacaoPdf):
    """PDF assinado ou protegido por integridade: nenhuma reescrita e tentada."""


class PdfMalformadoBloqueado(ErroSanitizacaoPdf):
    """Bytes que nao sao um PDF legivel: nenhuma reescrita e tentada."""


class ValidacaoSaidaBloqueada(ErroSanitizacaoPdf):
    """A saida falhou na validacao de integridade visual: nada e entregue."""


@dataclass
class RelatorioSanitizacao:
    """Auditoria do que saiu, do que ficou e do que foi neutralizado."""

    politica: str
    paginas: int = 0
    docinfo_removido: List[Dict[str, str]] = field(default_factory=list)
    docinfo_preservado: List[str] = field(default_factory=list)
    xmp_stream_removido: bool = False
    xmp_bytes_antes: int = 0
    xmp_nos_removidos: List[str] = field(default_factory=list)
    acoes_neutralizadas: List[str] = field(default_factory=list)
    acoes_remanescentes: List[str] = field(default_factory=list)
    openaction_preservado: bool = False
    assinaturas_detectadas: List[str] = field(default_factory=list)
    id_removido: bool = False
    marca_deepseek: Dict[str, Any] = field(default_factory=dict)
    validacao: Dict[str, Any] = field(default_factory=dict)
    sha256_entrada: str = ""
    sha256_saida: str = ""

    def to_dict(self) -> Dict[str, Any]:
        dados = asdict(self)
        dados["metadados_a_reinserir"] = self.metadados_a_reinserir
        return dados

    @property
    def metadados_a_reinserir(self) -> Dict[str, str]:
        """Mapa chave -> valor original para o operador reinserir depois."""
        return {item["chave"].lstrip("/").lower(): item["valor"] for item in self.docinfo_removido}


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
_CONFIG_PADRAO: Dict[str, Any] = {
    "politica": policy.POLITICA_ATIVA,
    "visual": {
        "preservar_page_streams": True,
        "preservar_xobjects": True,
        "preservar_texto_renderizado": True,
        "preservar_marcas_visuais": True,
    },
    "metadata": {
        "wipe_docinfo": True,
        "remove_xmp": True,
        "remover_autoria_legada": True,
        "remover_procedencia_legada": True,
        "remover_tecnico": True,
        "remover_marca_dagua": True,
        "remover_id": True,
    },
    "active_content": {
        "remover_open_action": True,
        "remover_open_action_seguras": False,
        "remover_javascript": True,
        "remover_additional_actions": True,
        "remover_names_javascript": True,
    },
    "marca_deepseek": {"ativado": False, "modo": "proveniencia", "texto": "DeepSeek"},
}


def _fundir(base: Dict[str, Any], novo: Dict[str, Any]) -> Dict[str, Any]:
    resultado = dict(base)
    for chave, valor in (novo or {}).items():
        if isinstance(valor, dict) and isinstance(resultado.get(chave), dict):
            resultado[chave] = _fundir(resultado[chave], valor)
        else:
            resultado[chave] = valor
    return resultado


def _config_normalizado(config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    return _fundir(_CONFIG_PADRAO, config or {})


def politica_vigente(config: Optional[Dict[str, Any]] = None) -> str:
    """Nome da politica que sera aplicada com ``config``."""
    return policy.normalizar_politica(_config_normalizado(config).get("politica"))


# ---------------------------------------------------------------------------
# Inspecao
# ---------------------------------------------------------------------------
def _dic(obj: Any) -> bool:
    return isinstance(obj, (pikepdf.Dictionary, pikepdf.Stream))


def _detectar_assinaturas(pdf: pikepdf.Pdf) -> List[str]:
    """Indicios estruturais de assinatura/protecao por integridade."""
    motivos: List[str] = []
    root = pdf.Root
    acroform = root.get("/AcroForm")
    if _dic(acroform):
        flags = acroform.get("/SigFlags")
        if flags is not None:
            try:
                if int(flags) != 0:
                    motivos.append("/AcroForm/SigFlags=%d" % int(flags))
            except (TypeError, ValueError):
                motivos.append("/AcroForm/SigFlags")
        if acroform.get("/XFA") is not None:
            motivos.append("/AcroForm/XFA")
        for campo in list(acroform.get("/Fields") or []):
            if _dic(campo) and str(campo.get("/FT") or "") == "/Sig":
                motivos.append("/AcroForm/Fields[/FT=/Sig]")
    perms = root.get("/Perms")
    if _dic(perms):
        for nome in ("/DocMDP", "/UR", "/UR3", "/SigFieldLock"):
            if perms.get(nome) is not None:
                motivos.append("/Perms" + nome)
    for obj in pdf.objects:
        if not _dic(obj):
            continue
        try:
            if obj.get("/ByteRange") is not None or str(obj.get("/Type") or "") == "/Sig":
                motivos.append("/Sig+ByteRange")
                break
        except Exception:
            continue
    return sorted(set(motivos))


def _hash_stream(obj: Any) -> str:
    try:
        return hashlib.sha256(obj.read_bytes()).hexdigest()
    except Exception:
        return "inalegivel"


def _instantaneo_visual(pdf: pikepdf.Pdf) -> Dict[str, Any]:
    """Assinatura da camada visual por pagina (usado na validacao fail-closed)."""
    paginas: List[Dict[str, Any]] = []
    for pagina in pdf.pages:
        obj = pagina.obj
        try:
            media = tuple(float(v) for v in pagina.mediabox)
        except Exception:
            media = ()
        conteudo = obj.get("/Contents")
        if conteudo is None:
            streams: List[str] = []
        elif isinstance(conteudo, pikepdf.Array):
            streams = [_hash_stream(s) for s in conteudo]
        else:
            streams = [_hash_stream(conteudo)]
        xobjects: List[Tuple[str, str, Tuple[float, ...]]] = []
        recursos = obj.get("/Resources")
        if _dic(recursos):
            dicionario = recursos.get("/XObject")
            if _dic(dicionario):
                for nome in sorted(dicionario.keys()):
                    sub = dicionario[nome]
                    caixa = tuple(float(v) for v in sub.get("/BBox") or []) if _dic(sub) else ()
                    xobjects.append((str(nome), str(sub.get("/Subtype") or "") if _dic(sub) else "", caixa))
        paginas.append(
            {
                "pagina": len(paginas),
                "mediabox": media,
                "page_streams": streams,
                "xobjects": xobjects,
                "rotate": str(obj.get("/Rotate") or "0"),
            }
        )
    return {"total": len(paginas), "paginas": paginas}


def _extrair_textos(dados: bytes) -> Optional[List[str]]:
    """Texto por pagina via pypdfium2; ``None`` se o leitor nao estiver disponivel."""
    try:
        import pypdfium2 as pdfium
    except Exception:
        return None
    try:
        documento = pdfium.PdfDocument(dados)
    except Exception:
        return None
    textos: List[str] = []
    try:
        for indice in range(len(documento)):
            pagina = documento[indice]
            try:
                textos.append(pagina.get_textpage().get_text_bounded())
            except Exception:
                textos.append("")
    finally:
        try:
            documento.close()
        except Exception:
            pass
    return textos


# ---------------------------------------------------------------------------
# Conteudo ativo
# ---------------------------------------------------------------------------
def _tipo_acao(acao: Any) -> str:
    if _dic(acao):
        return str(acao.get("/S") or "")
    if isinstance(acao, pikepdf.Array) and len(acao):
        return _tipo_acao(acao[-1])
    return ""


def _neutralizar_acoes(pdf: pikepdf.Pdf, cfg: Dict[str, Any]) -> Tuple[List[str], bool]:
    """Arranca scripts/acoes; preserva navegacao interna /GoTo por padrao."""
    ativo = cfg["active_content"]
    neutralizadas: List[str] = []
    preservado = False
    root = pdf.Root

    chaves_script = ("/JavaScript", "/JS") if ativo.get("remover_javascript", True) else ()
    chaves_aa = ("/AA",) if ativo.get("remover_additional_actions", True) else ()

    for chave in chaves_script + chaves_aa:
        if root.get(chave) is not None:
            del root[chave]
            neutralizadas.append("/Root" + chave)

    nomes = root.get("/Names")
    if ativo.get("remover_names_javascript", True) and _dic(nomes):
        for chave in ("/JavaScript", "/JS"):
            if nomes.get(chave) is not None:
                del nomes[chave]
                neutralizadas.append("/Root/Names" + chave)

    openaction = root.get("/OpenAction")
    if openaction is not None and ativo.get("remover_open_action", True):
        tipo = _tipo_acao(openaction)
        perigosa = tipo in policy.ACOES_AUTOMATICAS_PERIGOSAS
        seguras_fora = bool(ativo.get("remover_open_action_seguras", False))
        if perigosa or seguras_fora:
            del root["/OpenAction"]
            neutralizadas.append("/Root/OpenAction[" + (tipo or "?") + "]")
        elif tipo in policy.ACOES_DE_NAVIGACAO_SEGURAS or not tipo:
            preservado = True

    alvos_pagina = tuple(dict.fromkeys(chaves_script + chaves_aa + (("/OpenAction",) if ativo.get("remover_open_action", True) else ())))
    for pagina in pdf.pages:
        obj = pagina.obj
        for chave in alvos_pagina:
            if obj.get(chave) is not None:
                if chave == "/OpenAction" and not (_tipo_acao(obj[chave]) in policy.ACOES_AUTOMATICAS_PERIGOSAS) and not ativo.get("remover_open_action_seguras", False):
                    preservado = True
                    continue
                del obj[chave]
                neutralizadas.append("/Page" + chave)

    for obj in pdf.objects:
        if not _dic(obj):
            continue
        for chave in chaves_script + chaves_aa:
            try:
                if obj.get(chave) is not None:
                    del obj[chave]
                    neutralizadas.append("/Obj" + chave)
            except Exception:
                continue
        acao = obj.get("/A")
        if _dic(acao):
            tipo = str(acao.get("/S") or "")
            if tipo in policy.ACOES_AUTOMATICAS_PERIGOSAS:
                del obj["/A"]
                neutralizadas.append("/A[" + tipo + "]")

    return sorted(set(neutralizadas)), preservado


# ---------------------------------------------------------------------------
# Metadados
# ---------------------------------------------------------------------------
def _sanear_docinfo(pdf: pikepdf.Pdf, alvo: str, cfg: Dict[str, Any]) -> Tuple[List[Dict[str, str]], List[str]]:
    """Expurga DocInfo. Na politica completa, apaga o dicionario inteiro."""
    registro: List[Dict[str, str]] = []
    preservados: List[str] = []
    md = cfg["metadata"]
    info = pdf.trailer.get("/Info")
    if not _dic(info) or not md.get("wipe_docinfo", True):
        return registro, preservados
    wipe_total = alvo == policy.POLITICA_COMPLETA
    for chave in list(info.keys()):
        valor = str(info[chave])
        if wipe_total:
            decisao, motivo, grupo = policy.REMOVER, "DocInfo em limpeza completa", "legado"
        else:
            decisao, motivo = policy.decisao_para_chave(chave, valor, alvo)
            grupo = policy.grupo_da_chave(chave)
        if decisao == policy.REMOVER:
            registro.append({"chave": str(chave), "valor": valor, "grupo": grupo, "motivo": motivo})
            del info[chave]
        else:
            preservados.append(str(chave))
    if wipe_total and pdf.trailer.get("/Info") is not None:
        del pdf.trailer["/Info"]
    return registro, preservados


def _remover_id(pdf: pikepdf.Pdf, cfg: Dict[str, Any]) -> bool:
    if pdf.trailer.get("/ID") is not None and cfg["metadata"].get("remover_id", True):
        del pdf.trailer["/ID"]
        return True
    return False


def _expurgar_xmp(pdf: pikepdf.Pdf, alvo: str, cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Politica completa remove o stream; conservadora reescreve sem nos tecnicos."""
    info: Dict[str, Any] = {"stream_removido": False, "bytes_antes": 0, "nos_removidos": []}
    if not cfg["metadata"].get("remove_xmp", True):
        return info
    root = pdf.Root
    stream = root.get("/Metadata")
    if stream is None:
        return info
    try:
        pacote = stream.read_bytes()
    except Exception:
        pacote = b""
    info["bytes_antes"] = len(pacote)

    if alvo == policy.POLITICA_COMPLETA:
        del root["/Metadata"]
        info["stream_removido"] = True
        return info

    tecnicos = {policy.normalizar_chave(n) for n in policy.XMP_TECNICOS}
    removendo = False
    try:
        arvore = etree.fromstring(pacote)
        alvos = []
        for no in arvore.iter():
            if not isinstance(no.tag, str):
                continue
            try:
                local = etree.QName(no.tag).localname
            except ValueError:
                continue
            nome = policy.normalizar_chave(local)
            texto = (no.text or "").strip()
            if nome in tecnicos:
                alvos.append((no, "no tecnico de XMP"))
            elif texto and policy.decisao_para_chave(nome, texto, alvo)[0] == policy.REMOVER:
                alvos.append((no, "campo legado por valor"))
        for no, motivo in alvos:
            pai = no.getparent()
            if pai is None:
                continue
            pai.remove(no)
            info["nos_removidos"].append(str(etree.QName(no.tag).localname) + " (" + motivo + ")")
        if alvos:
            novo_pacote = etree.tostring(arvore, xml_declaration=True, encoding="UTF-8", standalone=True)
            root["/Metadata"] = pikepdf.Stream(pdf, novo_pacote, Type=pikepdf.Name("/Metadata"), Subtype=pikepdf.Name("/XML"))
            removendo = True
    except Exception:
        del root["/Metadata"]
        info["stream_removido"] = True
        return info

    if removendo and not info["stream_removido"]:
        info["reescrito"] = True
    return info


# ---------------------------------------------------------------------------
# Marca de proveniencia (opcional, nunca visual)
# ---------------------------------------------------------------------------
def _aplicar_marca(pdf: pikepdf.Pdf, cfg: Dict[str, Any]) -> Dict[str, Any]:
    marca = cfg["marca_deepseek"]
    if not marca.get("ativado", False):
        return {
            "aplicado": False,
            "motivo": "desabilitado por padrao; nenhuma alteracao visual ou de metadado",
            "modo": marca.get("modo", "proveniencia"),
        }
    if marca.get("modo", "proveniencia") != "proveniencia":
        return {"aplicado": False, "motivo": "modo de marca visual nao suportado pelo agente"}
    texto = str(marca.get("texto") or "DeepSeek")
    info = pdf.trailer.get("/Info")
    if not _dic(info):
        info = pdf.make_indirect(pikepdf.Dictionary())
        pdf.trailer["/Info"] = info
    info["/Producer"] = texto
    info["/Creator"] = texto
    return {
        "aplicado": True,
        "modo": "proveniencia",
        "texto": texto,
        "chaves": ["/Producer", "/Creator"],
        "visual": "nenhum conteudo de pagina foi desenhado ou alterado",
    }


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
def sanitizar_pdf(
    pdf_bytes: bytes,
    config: Optional[Dict[str, Any]] = None,
    *,
    politica: Optional[str] = None,
) -> Tuple[bytes, RelatorioSanitizacao]:
    """Sanear metadados legados e conteudo ativo de um PDF em memoria.

    Retorna ``(bytes_saneados, RelatorioSanitizacao)``. Aborta com
    subclass de ``ValueError`` para criptografado, assinado ou malformado,
    e se a saida nao reproduzir a camada visual da entrada.
    """
    if not isinstance(pdf_bytes, (bytes, bytearray, memoryview)):
        raise TypeError("sanitizar_pdf espera bytes; recebeu " + type(pdf_bytes).__name__)
    entrada = bytes(pdf_bytes)
    sha_entrada = hashlib.sha256(entrada).hexdigest()
    if not entrada.startswith(b"%PDF"):
        raise PdfMalformadoBloqueado("Conteudo nao e um PDF (assinatura %PDF ausente).")

    cfg = _config_normalizado(config)
    alvo = policy.normalizar_politica(politica if politica is not None else cfg.get("politica"))

    try:
        pdf = pikepdf.Pdf.open(io.BytesIO(entrada))
    except pikepdf.PasswordError as exc:
        raise PdfCriptografadoBloqueado("PDF criptografado: sanitizacao bloqueada sem escrita.") from exc
    except pikepdf.PdfError as exc:
        raise PdfMalformadoBloqueado("PDF malformado ou ilegivel: " + str(exc)) from exc
    except Exception as exc:
        raise PdfMalformadoBloqueado("Falha ao abrir o PDF: " + str(exc)) from exc

    relatorio = RelatorioSanitizacao(politica=alvo)
    try:
        if pdf.is_encrypted:
            raise PdfCriptografadoBloqueado("PDF criptografado: sanitizacao bloqueada sem escrita.")

        motivos = _detectar_assinaturas(pdf)
        relatorio.assinaturas_detectadas = motivos
        if motivos:
            raise PdfAssinadoBloqueado(
                "PDF assinado/protegido (" + ", ".join(motivos) + "): sanitizacao bloqueada sem escrita."
            )

        antes = _instantaneo_visual(pdf)
        texto_antes = _extrair_textos(entrada)
        relatorio.paginas = antes["total"]

        acoes, preservou = _neutralizar_acoes(pdf, cfg)
        relatorio.acoes_neutralizadas = acoes
        relatorio.openaction_preservado = preservou
        relatorio.docinfo_removido, relatorio.docinfo_preservado = _sanear_docinfo(pdf, alvo, cfg)
        xmp = _expurgar_xmp(pdf, alvo, cfg)
        relatorio.xmp_stream_removido = bool(xmp["stream_removido"])
        relatorio.xmp_bytes_antes = int(xmp["bytes_antes"])
        relatorio.xmp_nos_removidos = list(xmp["nos_removidos"])
        relatorio.id_removido = _remover_id(pdf, cfg)
        relatorio.marca_deepseek = _aplicar_marca(pdf, cfg)

        saida = _salvar(pdf)
    finally:
        pdf.close()

    _validar(entrada, saida, antes, texto_antes, alvo, relatorio, sha_entrada)
    relatorio.sha256_entrada = sha_entrada
    relatorio.sha256_saida = hashlib.sha256(saida).hexdigest()
    return saida, relatorio


def _salvar(pdf: pikepdf.Pdf) -> bytes:
    buffer = io.BytesIO()
    pdf.save(
        buffer,
        compress_streams=True,
        object_stream_mode=pikepdf.ObjectStreamMode.preserve,
        fix_metadata_version=False,
        preserve_pdfa=False,
    )
    return buffer.getvalue()


def _acoes_perigosas_remanescentes(pdf: pikepdf.Pdf) -> List[str]:
    """Varredura final: nenhuma acao que executa codigo pode sobreviver."""
    sobras: List[str] = []
    for obj in pdf.objects:
        if not _dic(obj):
            continue
        try:
            for chave in ("/JavaScript", "/JS", "/AA"):
                if obj.get(chave) is not None:
                    sobras.append(chave)
            tipo = _tipo_acao(obj)
            if tipo in policy.ACOES_AUTOMATICAS_PERIGOSAS:
                sobras.append(tipo)
        except Exception:
            continue
    return sorted(set(sobras))


def _validar(
    entrada: bytes,
    saida: bytes,
    antes: Dict[str, Any],
    texto_antes: Optional[List[str]],
    alvo: str,
    relatorio: RelatorioSanitizacao,
    sha_entrada: str,
) -> None:
    """Tudo ou nada: se a camada visual nao for idempotente, nada e entregue."""
    checagens: Dict[str, Any] = {}
    falhas: List[str] = []

    checagens["cabecalho_pdf"] = saida.startswith(b"%PDF")
    if not checagens["cabecalho_pdf"]:
        falhas.append("saida sem cabecalho %PDF")

    texto_depois = _extrair_textos(saida)
    try:
        reaberto = pikepdf.Pdf.open(io.BytesIO(saida))
    except Exception as exc:
        falhas.append("reabertura falhou: " + type(exc).__name__)
        reaberto = None

    if reaberto is not None:
        checagens["reabre"] = True
        depois = _instantaneo_visual(reaberto)
        checagens["paginas_iguais"] = antes["total"] == depois["total"]
        checagens["mediabox_iguais"] = [p["mediabox"] for p in antes["paginas"]] == [p["mediabox"] for p in depois["paginas"]]
        checagens["page_streams_iguais"] = [p["page_streams"] for p in antes["paginas"]] == [p["page_streams"] for p in depois["paginas"]]
        checagens["xobjects_iguais"] = [p["xobjects"] for p in antes["paginas"]] == [p["xobjects"] for p in depois["paginas"]]
        checagens["rotate_igual"] = [p["rotate"] for p in antes["paginas"]] == [p["rotate"] for p in depois["paginas"]]
        root = reaberto.Root
        checagens["xmp_ausente"] = alvo != policy.POLITICA_COMPLETA or root.get("/Metadata") is None
        marcado = bool(relatorio.marca_deepseek.get("aplicado"))
        checagens["docinfo_ausente"] = (
            alvo != policy.POLITICA_COMPLETA or marcado or reaberto.trailer.get("/Info") is None
        )
        for chave in ("/JavaScript", "/JS", "/AA"):
            checagens["ausencia" + chave] = root.get(chave) is None
        sobras = _acoes_perigosas_remanescentes(reaberto)
        relatorio.acoes_remanescentes = sobras
        checagens["sem_acoes_perigosas"] = not sobras
        nomes = root.get("/Names")
        checagens["names_javascript_ausente"] = not (_dic(nomes) and nomes.get("/JavaScript") is not None)
        reaberto.close()
    else:
        checagens["reabre"] = False

    if texto_antes is not None and texto_depois is not None:
        checagens["texto_igual"] = texto_antes == texto_depois
    else:
        checagens["texto_igual"] = "indisponivel (pypdfium2 nao leu a amostra)"

    checagens["entrada_imutavel"] = hashlib.sha256(entrada).hexdigest() == sha_entrada

    for nome, valor in checagens.items():
        if valor is False:
            falhas.append(nome)
    relatorio.validacao = checagens
    if falhas:
        raise ValidacaoSaidaBloqueada(
            "Sanitizacao abortada na validacao de saida: " + "; ".join(falhas)
        )