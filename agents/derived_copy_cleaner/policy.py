"""Politica de sanitizacao de copias derivadas: unica fonte de verdade.

Decisao de arquitetura (2026-10-11)
----------------------------------
**POLITICA_COMPLETA - Sanitizacao Completa de Metadados Legados.** A copia
derivada intermediaria e preparada para posterior reinsercao de metadados
consolidados pelo operador, portanto TODO registro interno legado sai: os
metadados tecnicos e os metadados de autoria/origem/procedencia
(``author``, ``creator``, ``producer``, ``owner``, ``origem``, ``source``,
``origin``), tanto no DocInfo quanto no XMP.

A politica anterior (``POLITICA_CONSERVADORA``, que preservava ``watermark``
quando o valor carregava titularidade e mantinha autoria/procedencia)
continua implementada e enderecavel pelo nome. A inversao e assim
auditavel e reversivel, e o classificador de valor segue vivo como
rotulo de auditoria.

Limites inegociaveis das duas politicas
---------------------------------------
A **camada visual** nunca e tocada: page streams, texto renderizado,
imagens, XObjects/Form XObjects, anotacoes de aparencia, geometria da
pagina e carimbos visiveis de marca-d'agua permanecem byte a byte.
Sanear metadado nao pode corromper nem redesenhar a pagina.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, Iterable, List, Tuple

# ---------------------------------------------------------------------------
# Politicas
# ---------------------------------------------------------------------------
POLITICA_COMPLETA = "sanitizacao_completa_metadados_legados"
POLITICA_CONSERVADORA = "regra_por_valor_conservadora"
POLITICAS = (POLITICA_COMPLETA, POLITICA_CONSERVADORA)
POLITICA_ATIVA = POLITICA_COMPLETA

REMOVER = "remover"
PRESERVAR = "preservar"

# ---------------------------------------------------------------------------
# Conjuntos de chaves
# ---------------------------------------------------------------------------

#: Metadados tecnicos de ferramenta: removidos em qualquer politica.
CHAVES_TECNICAS_REMOVIDAS: Tuple[str, ...] = (
    "technical_metadata",
    "software",
    "tool_chain",
    "fingerprint",
)

#: Familia marca-d'agua. Removida junto na politica completa; na
#: conservadora a remocao dependia do VALOR.
CHAVES_MARCA_DAGUA: Tuple[str, ...] = (
    "watermark",
    "marca_dagua",
    "marca_d_agua",
    "marcadagua",
    "marca_de_agua",
)

#: Nome historico importado por agent.py e testes: tecnicos + marca-d'agua.
CHAVES_TECNICAS_PROIBIDAS: Tuple[str, ...] = CHAVES_TECNICAS_REMOVIDAS + CHAVES_MARCA_DAGUA

#: Metadados de autoria/origem/procedencia legados. Movidos para remocao
#: ativa pela decisao de 2026-10-11.
CHAVES_AUTORIA_LEGADA: Tuple[str, ...] = (
    "author",
    "creator",
    "producer",
    "owner",
    "origem",
    "source",
    "origin",
)

#: Campos de identificacao legados que tambem preparam a reinsercao
#: consolidada pelo operador.
CHAVES_IDENTIFICACAO_LEGADA: Tuple[str, ...] = (
    "title",
    "subject",
    "keywords",
    "copyright",
    "rights",
    "creationdate",
    "moddate",
    "date",
    "datesecured",
    "trapped",
)

#: Universo legado expurgado pela POLITICA_COMPLETA.
CHAVES_LEGADAS_REMOVIDAS: Tuple[str, ...] = (
    CHAVES_TECNICAS_REMOVIDAS
    + CHAVES_MARCA_DAGUA
    + CHAVES_AUTORIA_LEGADA
    + CHAVES_IDENTIFICACAO_LEGADA
)

#: Nome historico mantido para compatibilidade de import.
CHAVES_PROIBIDAS: Tuple[str, ...] = CHAVES_LEGADAS_REMOVIDAS

#: Na POLITICA_COMPLETA nenhuma chave de metadado e preservada; a
#: preservacao migrou das chaves para a camada visual.
CHAVES_PRESERVADAS: Tuple[str, ...] = ()

#: O que a sanitizacao nunca toca.
CAMADAS_PRESERVADAS: Tuple[str, ...] = (
    "page_streams",
    "texto_renderizado",
    "imagens",
    "xobjects",
    "form_xobjects",
    "anotacoes_de_aparencia",
    "geometria_da_pagina",
    "carimbos_visiveis_de_marca_dagua",
)

#: Acoes automaticas neutralizadas.
ACOES_AUTOMATICAS_PERIGOSAS: Tuple[str, ...] = (
    "/JavaScript",
    "/JS",
    "/Launch",
    "/GoToR",
    "/URI",
    "/SubmitForm",
    "/ResetForm",
    "/ImportData",
    "/Hide",
)

#: Acoes de navegacao interna preservadas (nao executam codigo).
ACOES_DE_NAVIGACAO_SEGURAS: Tuple[str, ...] = ("/GoTo", "/Named")

#: Chaves de script/acao arrancadas do catalogo, paginas e anotacoes.
CHAVES_ACIONADORAS_PROIBIDAS: Tuple[str, ...] = (
    "/JavaScript",
    "/JS",
    "/AA",
    "/OpenAction",
)

#: Estruturas que indicam documento assinado ou protegido por integridade.
MARCADORES_ASSINATURA: Tuple[str, ...] = ("/ByteRange", "/Sig", "/SigFlags", "/XFA")

#: Nomos XMP tratados como tecnicos mesmo na politica conservadora.
XMP_TECNICOS: Tuple[str, ...] = (
    "creatortool",
    "documentid",
    "instanceid",
    "trackerid",
    "metadatadate",
    "metadataxmp",
    "xmpmlist",
    "fingerprint",
    "toolchain",
    "software",
)

#: Sinonimos de grafia alternativa (portugues/ingle) para as chaves legadas.
SINONIMOS: Dict[str, str] = {
    "titulo": "title",
    "assunto": "subject",
    "palavras_chave": "keywords",
    "palavra_chave": "keywords",
    "autor": "author",
    "autoria": "author",
    "produtor": "producer",
    "donos": "owner",
    "direitos_autorais": "copyright",
    "direitos": "rights",
    "data": "date",
    "data_de_criacao": "creationdate",
    "data_de_modificacao": "moddate",
    "marca": "watermark",
    "carimbo": "watermark",
    "ferramenta": "tool_chain",
    "versao_ferramenta": "tool_chain",
}


def _sem_acentos(texto: str) -> str:
    norm = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in norm if not unicodedata.combining(c))


def normalizar_chave(chave: Any) -> str:
    """Normaliza um nome de chave para decisao.

    Aceita ``/Author``, ``Author``, ``dc:creator``, ``xmp:CreatorTool``,
    ``marca-d'agua`` ou ``Titulo`` e devolve ``author``, ``creator``,
    ``creatortool``, ``marca_dagua`` ou ``title``.
    """
    texto = str(chave).strip().lstrip("/").lower()
    texto = _sem_acentos(texto)
    if ":" in texto:
        texto = texto.rsplit(":", 1)[-1]
    texto = texto.replace("-", "_").replace(" ", "_").replace(".", "_").replace("'", "").replace("’", "")
    while "__" in texto:
        texto = texto.replace("__", "_")
    texto = texto.strip("_")
    if texto in ("marca_d_agua", "marca_dagua_xmp", "marcadagua", "marca_de_agua"):
        texto = "marca_dagua"
    return SINONIMOS.get(texto, texto)


# ---------------------------------------------------------------------------
# Classificador de valor
# ---------------------------------------------------------------------------
_SINAIS_TITULARIDADE: Tuple[str, ...] = (
    "\u00a9", "(c)", "todos os direitos", "direitos reservados", "direitos de autor",
    "all rights reserved", "copyright", "autor", "autoria", "por ", " by ",
    "professor", "prof.", "elaborado", "redigido", "revisado", "assinatura",
    "plataforma", "instituto", "editora", "escola", "universidade", "faculdade",
    "secretaria", "governo", "prefeitura", "orgao", "bombeiros", "cbmerj", "cbmrj",
    "concurso", "concursoai", "deepseek", "http://", "https://", "www.", "@",
    ".com", ".br", ".org", ".net", ".edu", ".io",
)
_BOOLEANS = {"true", "false", "sim", "nao", "yes", "no", "1", "0", "null", "none", "n/a", "na", ""}
_RE_VERSAO = re.compile(r"^(?:v|versao|version)?\d+(?:[._-]\d+){0,4}$", re.IGNORECASE)
_RE_HASH = re.compile(r"^[0-9a-f]{16,128}$", re.IGNORECASE)
_RE_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)
_RE_DOMINIO = re.compile(r"[a-z0-9][a-z0-9-]*(?:\.[a-z]{2,}){1,3}", re.IGNORECASE)


def _eh_identificador_ferramenta(texto: str) -> bool:
    if not texto or " " in texto or not texto.isascii():
        return False
    compacto = texto.replace("_", "").replace("-", "").replace(".", "")
    return compacto.isalnum() and any(letra.isdigit() for letra in compacto)


def classificar_valor_marca_dagua(valor: Any) -> Tuple[str, str]:
    """Classifica o **valor** de um campo de marca-d'agua.

    Retorna ``("titularidade"|"tecnico"|"ambiguo", motivo)``.
    ``titularidade`` e ``ambiguo`` carregam possivel autoria; ``tecnico``
    e estritamente instrumental. Na POLITICA_COMPLETA os tres sao
    REMOVIDOS e a classificacao vira rotulo do relatorio de auditoria.
    """
    if valor is None:
        return "tecnico", "valor ausente"
    texto = _sem_acentos(str(valor).strip()).lower()
    if not texto:
        return "tecnico", "valor vazio"
    if _RE_DOMINIO.search(texto):
        return "titularidade", "contem dominio/URL"
    for sinal in _SINAIS_TITULARIDADE:
        if sinal in texto:
            return "titularidade", "contem sinal de titularidade: " + sinal.strip()
    if texto in _BOOLEANS:
        return "tecnico", "booleano/flag instrumental"
    if _RE_VERSAO.match(texto) or _RE_HASH.match(texto) or _RE_UUID.match(texto):
        return "tecnico", "versao, hash ou identificador"
    if _eh_identificador_ferramenta(texto):
        return "tecnico", "identificador de ferramenta"
    palavras = [p for p in re.split(r"[\s_]+", texto) if p]
    if len(palavras) == 1 and len(palavras[0]) == 1:
        return "tecnico", "token instrumental"
    return "ambiguo", "sem forma tecnica reconhecida"


def normalizar_politica(politica: Any) -> str:
    """Aceita nome explicito, ``None`` ou apelido e devolve a politica valida."""
    if politica is None:
        return POLITICA_ATIVA
    texto = str(politica).strip().lower()
    if texto in POLITICAS:
        return texto
    if texto in ("completa", "total", "full"):
        return POLITICA_COMPLETA
    if texto in ("conservadora", "valor", "by_value"):
        return POLITICA_CONSERVADORA
    raise ValueError(
        f"Politica desconhecida: {politica!r}. Valores aceitos: {list(POLITICAS)}."
    )


def decisao_para_chave(
    chave: Any,
    valor: Any = None,
    politica: Any = None,
) -> Tuple[str, str]:
    """Decide ``remover``/``preservar`` para uma chave de metadado."""
    alvo = normalizar_politica(politica)
    nome = normalizar_chave(chave)
    tecnicas = {normalizar_chave(c) for c in CHAVES_TECNICAS_REMOVIDAS}
    marca = {normalizar_chave(c) for c in CHAVES_MARCA_DAGUA}
    autoria = {normalizar_chave(c) for c in CHAVES_AUTORIA_LEGADA}
    identificacao = {normalizar_chave(c) for c in CHAVES_IDENTIFICACAO_LEGADA}

    if nome in tecnicas:
        return REMOVER, "metadado tecnico de ferramenta"

    if nome in marca:
        classificacao, motivo = classificar_valor_marca_dagua(valor)
        if alvo == POLITICA_COMPLETA:
            aviso = "" if classificacao == "tecnico" else " (valor carregava possivel titularidade)"
            return REMOVER, "marca-d'agua expurgada pela sanitizacao completa" + aviso
        if classificacao == "tecnico":
            return REMOVER, "marca-d'agua estritamente instrumental: " + motivo
        return PRESERVAR, "marca-d'agua com titularidade/ambigua: " + motivo

    if alvo == POLITICA_COMPLETA:
        if nome in autoria:
            return REMOVER, "autoria/origem legada expurgada para reinsercao consolidada"
        if nome in identificacao:
            return REMOVER, "identificacao legada expurgada para reinsercao consolidada"
        return REMOVER, "registro legado expurgado (DocInfo/xmp em limpeza completa)"

    if nome in autoria or nome in identificacao:
        return PRESERVAR, "titularidade/procedencia obrigatoria nesta politica"
    return PRESERVAR, "chave desconhecida: default conservador preserva"


def grupo_da_chave(chave: Any) -> str:
    """Grupo de politica ao qual a chave pertence (rotulo do relatorio)."""
    nome = normalizar_chave(chave)
    if nome in {normalizar_chave(c) for c in CHAVES_TECNICAS_REMOVIDAS}:
        return "tecnico"
    if nome in {normalizar_chave(c) for c in CHAVES_MARCA_DAGUA}:
        return "marca_dagua"
    if nome in {normalizar_chave(c) for c in CHAVES_AUTORIA_LEGADA}:
        return "autoria"
    if nome in {normalizar_chave(c) for c in CHAVES_IDENTIFICACAO_LEGADA}:
        return "identificacao"
    return "outro_legado"


def eh_chave_removivel(chave: Any, valor: Any = None, politica: Any = None) -> bool:
    """True se a chave deve sair do documento sob a politica informada."""
    decisao, _ = decisao_para_chave(chave, valor, politica)
    return decisao == REMOVER


def chaves_proibidas_presentes(
    metadados: Dict[str, Any],
    politica: Any = None,
) -> List[str]:
    """Chaves efetivamente removiveis presentes em ``metadados``."""
    return [
        str(chave)
        for chave, valor in (metadados or {}).items()
        if decisao_para_chave(chave, valor, politica)[0] == REMOVER
    ]


def chaves_preservadas(metadados: Dict[str, Any], politica: Any = None) -> List[str]:
    """Chaves preservadas pela politica informada (auditoria de saida)."""
    return [
        str(chave)
        for chave, valor in (metadados or {}).items()
        if decisao_para_chave(chave, valor, politica)[0] == PRESERVAR
    ]


def separar_metadados(
    metadados: Dict[str, Any],
    politica: Any = None,
) -> Tuple[Dict[str, Any], List[str], List[Dict[str, str]]]:
    """Aplica a politica a um dicionario de metadados.

    Retorna ``(limpos, nomes_removidos, registro_removido)`` onde
    ``registro_removido`` traz ``{"chave", "valor", "grupo", "motivo"}`` de
    cada expurgo: o operador usa esse registro para reinserir os metadados
    consolidados.
    """
    alvo = normalizar_politica(politica)
    limpos: Dict[str, Any] = {}
    removidas: List[str] = []
    registro: List[Dict[str, str]] = []
    for chave, valor in (metadados or {}).items():
        decisao, motivo = decisao_para_chave(chave, valor, alvo)
        if decisao == REMOVER:
            removidas.append(str(chave))
            registro.append(
                {
                    "chave": str(chave),
                    "valor": "" if valor is None else str(valor),
                    "grupo": grupo_da_chave(chave),
                    "motivo": motivo,
                }
            )
        else:
            limpos[chave] = valor
    return limpos, removidas, registro


def remover_chaves(metadados: Dict[str, Any], chaves: Iterable[str]) -> Dict[str, Any]:
    """Remove um conjunto explicito de chaves (comparacao normalizada)."""
    alvo = {normalizar_chave(c) for c in chaves}
    return {k: v for k, v in metadados.items() if normalizar_chave(k) not in alvo}


def resumo_politica(politica: Any = None) -> Dict[str, Any]:
    """Retrato serializavel da politica (para config.yaml, README e relatorio)."""
    alvo = normalizar_politica(politica)
    completa = alvo == POLITICA_COMPLETA
    return {
        "politica_ativa": alvo,
        "politicas_disponiveis": list(POLITICAS),
        "camada_visual_intacta": True,
        "docinfo": "wipe_total" if completa else "wipe_por_chave",
        "xmp": "stream_removido" if completa else "expurgo_por_no",
        "chaves_tecnicas_sempre_removidas": list(CHAVES_TECNICAS_REMOVIDAS),
        "chaves_marca_dagua": list(CHAVES_MARCA_DAGUA),
        "chaves_autoria_removidas": list(CHAVES_AUTORIA_LEGADA) if completa else [],
        "chaves_autoria_preservadas": [] if completa else list(CHAVES_AUTORIA_LEGADA),
        "chaves_identificacao_removidas": list(CHAVES_IDENTIFICACAO_LEGADA) if completa else [],
        "chaves_preservadas_por_valor": [] if completa else list(CHAVES_MARCA_DAGUA),
        "camadas_preservadas": list(CAMADAS_PRESERVADAS),
        "acoes_neutralizadas": list(ACOES_AUTOMATICAS_PERIGOSAS) + list(CHAVES_ACIONADORAS_PROIBIDAS),
        "acoes_de_navegacao_preservadas": list(ACOES_DE_NAVIGACAO_SEGURAS),
        "bloqueios": ["criptografado", "assinado", "malformado"],
        "auditoria_de_valores_removidos": True,
    }