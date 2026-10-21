# -*- coding: utf-8 -*-
"""
ConcursoAI — Extrator de Questões de Matemática (CBM-RJ / CBM-PE).
Processa as 20 apostilas (Aulas 00 a 19) e gera o acervo canônico em:
dataset/questoes/questoes_matematica.json
"""

import sys
import os
import re
import json
import hashlib
from pathlib import Path
from collections import Counter, defaultdict

import pypdfium2

ORIGEM_PDFS = Path(r"H:\Meu Drive\plataforma de estudo\cbm-rj\matematica")
DESTINO_JSON = Path(r"C:\plataforna de estudo\plataformadeestudo\dataset\questoes\questoes_matematica.json")

DISCIPLINA_CANONICA = "Matemática"
ALVO_APOSTILA = "CBM-PE (Soldado)"

RE_AULA = re.compile(r"aula-(\d{1,2})", re.IGNORECASE)
LINHA_INDICE = re.compile(
    r"(\d{1,2})\)\s*(Quest\u00f5es Comentadas|Lista de Quest\u00f5es)"
    r"\s*[-\u2013]\s*(.+?)\s+(\d{1,4})\s*$",
    re.IGNORECASE
)
RE_TITULO_SECAO = re.compile(r"^(QUEST[ÕO]ES COMENTADAS|LISTA DE QUEST[ÕO]ES)\b(?:\s*[-\u2013]\s*(.+))?", re.IGNORECASE)

# Ignora números com separador de milhar como "20.000 m3" ou "1.250 +"
RE_MATH_THOUSAND = re.compile(r"^\d{1,3}\.\d{3}(?:\s|\b|[a-zA-Z=+\-*/])")

RE_ANCORA_NUM = re.compile(r"^(\d{1,3})\.\s*(\(?\s*[A-Za-z0-9\s.\u2013-]+/[A-Za-z0-9\s.\u2013-]+.*)$")
RE_TAG_DIRETA = re.compile(r"^\(([A-Za-z0-9\s.\u2013-]+/[A-Za-z0-9\s.\u2013-]+(?:/[A-Za-z0-9\s.\u2013-]+)?)\)\s*(.*)$")
RE_TAG_ANUAL = re.compile(r"^\(([A-Za-z0-9\s.\u2013-]+(?:[-/][A-Za-z0-9\s.\u2013-]+)*\s*[-/]\s*(?:19|20)\d{2}[^)]*)\)\s*(.*)$")

RE_GABARITO = re.compile(
    r"gabarito\b[:\u2013\-]?\s*(?:letra|alternativa|op[çc][ãa]o)?\s*[:\u2013\-]?\s*([A-E]|certo|correto|errado|incorreto|verdadeiro|falso)\b",
    re.IGNORECASE
)
RE_ALT_START = re.compile(r"^([A-Ea-e])\)\s*(.+)$")
RE_ULTIMO_ANO = re.compile(r"(?<!\d)(19\d{2}|20\d{2})(?!\d)")
RE_TABELA_GABARITO = re.compile(r"^(\d{1,3})\s*[\.\-]?\s*(?:letra|alternativa|op[çc][ãa]o)?\s*([A-E]|certo|correto|errado|incorreto)\b", re.IGNORECASE)

CERTO_ERRADO_ALTS = {"C": "Certo", "E": "Errado"}

def clean_lines(doc):
    total = len(doc)
    pages = []
    for i in range(total):
        text = doc[i].get_textpage().get_text_bounded()
        raw_lines = [l.strip() for l in text.replace("\r\n", "\n").split("\n") if l.strip()]
        pages.append(raw_lines)
    
    cobertura = Counter()
    for raw_lines in pages:
        zonas = set(raw_lines[:4]) | set(raw_lines[-6:])
        for ln in zonas:
            if not re.match(r"^(coment|gabarito|quest|letra|certo|errado)", ln, re.I):
                cobertura[ln] += 1
    mobilia = {ln for ln, n in cobertura.items() if n >= 0.7 * total}
    
    cleaned = []
    for raw_lines in pages:
        c_page = []
        for ln in raw_lines:
            if ln in mobilia:
                continue
            if re.match(r"^\d{11}\s*[-\u2013]\s*\S", ln): # CPF PII
                continue
            if re.match(r"^\d{1,4}$", ln): # número de página isolado
                continue
            if re.match(r"^={2,}\s*[0-9a-fA-F]{4,8}\s*={2,}$", ln): # marca d'água
                continue
            c_page.append(ln)
        cleaned.append(c_page)
    return cleaned

def parse_tag(tag_str):
    crua = tag_str.strip("() ")
    segs = [s.strip() for s in crua.split("/") if s.strip()]
    ano = None
    banca = None
    orgao = None
    cargo = None
    
    for s in segs:
        m = RE_ULTIMO_ANO.search(s)
        if m:
            try:
                ano = int(m.group(1))
            except:
                pass
                
    if len(segs) >= 3:
        banca = segs[0]
        cargo = segs[1]
    elif len(segs) == 2:
        if any(b.lower() in segs[0].lower() for b in ["fgv", "cebraspe", "cespe", "vunesp", "fcc", "ibfc", "idecan", "quadrix", "aocp"]):
            banca = segs[0]
            orgao = segs[1]
        else:
            orgao = segs[0]
    elif len(segs) == 1:
        orgao = segs[0]
        
    return {
        "tag_crua": f"({crua})",
        "banca": banca,
        "orgao": orgao,
        "cargo": cargo,
        "ano": ano,
        "classificacao": "banca/cargo/ano" if (banca and cargo and ano) else ("orgao/ano" if orgao and ano else "geral")
    }

def normalizar_gabarito(raw):
    if not raw:
        return None
    r = raw.strip().upper()
    if r in ["C", "CERTO", "CORRETO", "VERDADEIRO"]:
        return "C"
    if r in ["E", "ERRADO", "INCORRETO", "FALSO"]:
        return "E"
    if r in ["A", "B", "C", "D", "E"]:
        return r
    return None

def extrair_aula(pdf_path, aula_num):
    doc = pypdfium2.PdfDocument(str(pdf_path))
    cleaned_pages = clean_lines(doc)
    doc.close()
    
    sections = []
    # 1. Procura no índice
    for p_idx in range(min(8, len(cleaned_pages))):
        for line in cleaned_pages[p_idx]:
            m_ind = LINHA_INDICE.search(line)
            if m_ind:
                num = int(m_ind.group(1))
                tipo = "comentada" if "comentada" in m_ind.group(2).lower() else "lista"
                tema = m_ind.group(3).strip()
                p_ini = int(m_ind.group(4))
                sections.append({"numero": num, "tipo": tipo, "tema": tema, "p_ini": p_ini, "p_fim": 0})
    
    if sections:
        sections.sort(key=lambda s: s["numero"])
        for idx in range(len(sections)):
            if idx + 1 < len(sections):
                sections[idx]["p_fim"] = sections[idx+1]["p_ini"] - 1
            else:
                sections[idx]["p_fim"] = len(cleaned_pages)
    else:
        # Fallback: Varre cabeçalhos das páginas
        sec_num = 1
        for p_idx, page in enumerate(cleaned_pages):
            for l in page:
                m_sec = RE_TITULO_SECAO.match(l)
                if m_sec:
                    tipo = "comentada" if "comentada" in m_sec.group(1).lower() else "lista"
                    tema = m_sec.group(2).strip() if m_sec.group(2) else f"Tópico Geral (Aula {aula_num:02d})"
                    sections.append({"numero": sec_num, "tipo": tipo, "tema": tema, "p_ini": p_idx + 1, "p_fim": len(cleaned_pages)})
                    sec_num += 1
                    break
        for idx in range(len(sections) - 1):
            sections[idx]["p_fim"] = sections[idx+1]["p_ini"] - 1

    if not sections:
        sections = [{"numero": 1, "tipo": "comentada", "tema": f"Matemática Geral (Aula {aula_num:02d})", "p_ini": 1, "p_fim": len(cleaned_pages)}]

    questoes_aula = []
    
    for sec in sections:
        p_start = max(0, sec["p_ini"] - 1)
        p_end = min(len(cleaned_pages), sec["p_fim"])
        
        sec_lines = []
        for p_idx in range(p_start, p_end):
            for l in cleaned_pages[p_idx]:
                sec_lines.append((p_idx + 1, l))
                
        cur_q = None
        seq_num = 0
        gabaritos_tabela = {}
        in_tabela_gabarito = False
        
        for p_num, line in sec_lines:
            ls = line.strip()
            
            # Tabela final de gabaritos da lista (apenas na seção lista e em linha autônoma)
            if sec["tipo"] == "lista" and re.match(r"^GABARITOS?\s*:?\s*$", ls, re.I):
                in_tabela_gabarito = True
                continue
            if in_tabela_gabarito:
                m_tab = RE_TABELA_GABARITO.match(ls)
                if m_tab:
                    gabaritos_tabela[int(m_tab.group(1))] = normalizar_gabarito(m_tab.group(2))
                continue
            
            # Ignora separador de milhar numérico
            if RE_MATH_THOUSAND.match(ls):
                if cur_q and not cur_q.get("in_comment", False):
                    cur_q["enunciado_linhas"].append(ls)
                continue
                
            # Detecção de início de questão
            m_num = RE_ANCORA_NUM.match(ls)
            m_tag = RE_TAG_DIRETA.match(ls)
            m_anual = RE_TAG_ANUAL.match(ls) if not (m_num or m_tag) else None
            
            is_start = False
            q_num = 0
            tag_text = ""
            rest_text = ""
            
            if m_num:
                is_start = True
                q_num = int(m_num.group(1))
                tag_match = re.search(r"\((.*?)\)", m_num.group(2))
                tag_text = tag_match.group(1) if tag_match else ""
                rest_text = m_num.group(2)[tag_match.end():].strip() if tag_match else m_num.group(2)
            elif m_tag:
                is_start = True
                seq_num += 1
                q_num = seq_num
                tag_text = m_tag.group(1).strip("()")
                rest_text = m_tag.group(2).strip()
            elif m_anual:
                is_start = True
                seq_num += 1
                q_num = seq_num
                tag_text = m_anual.group(1).strip("()")
                rest_text = m_anual.group(2).strip()
                
            if is_start:
                if cur_q:
                    questoes_aula.append(cur_q)
                seq_num = max(seq_num, q_num)
                cur_q = {
                    "aula": aula_num,
                    "secao": sec["numero"],
                    "secao_tipo": sec["tipo"],
                    "secao_rotulo": f"{'Questões Comentadas' if sec['tipo'] == 'comentada' else 'Lista de Questões'} - {sec['tema']}",
                    "tema": sec["tema"],
                    "numero": q_num,
                    "tag_raw": tag_text,
                    "enunciado_linhas": [rest_text] if rest_text else [],
                    "alternativas": {},
                    "gabarito": None,
                    "p_ini": p_num,
                    "p_fim": p_num,
                    "tipo": "multipla_escolha",
                    "origem_gabarito": "comentario" if sec["tipo"] == "comentada" else "lista"
                }
                continue
                
            if cur_q is None:
                continue
                
            cur_q["p_fim"] = p_num
            
            # Extração de Gabarito
            m_gab = RE_GABARITO.search(ls)
            if m_gab and not cur_q["gabarito"]:
                g_val = normalizar_gabarito(m_gab.group(1))
                if g_val:
                    cur_q["gabarito"] = g_val
                    if m_gab.group(1).upper() in ["CERTO", "CORRETO", "ERRADO", "INCORRETO"]:
                        cur_q["tipo"] = "certo_errado"
                continue
                
            # Alternativas
            m_alt = RE_ALT_START.match(ls)
            if m_alt and not re.match(r"^coment", ls, re.I):
                letra = m_alt.group(1).upper()
                alt_txt = m_alt.group(2).strip()
                cur_q["alternativas"][letra] = alt_txt
                continue
                
            if re.match(r"^coment[áa]rios?\b", ls, re.I):
                cur_q["in_comment"] = True
                continue
                
            if not cur_q.get("in_comment", False):
                cur_q["enunciado_linhas"].append(ls)
                
        if cur_q:
            questoes_aula.append(cur_q)
            
        # Aplica gabarito da tabela se a questão ficou sem
        for q in questoes_aula:
            if not q["gabarito"] and q["numero"] in gabaritos_tabela:
                q["gabarito"] = gabaritos_tabela[q["numero"]]
                q["origem_gabarito"] = "tabela"
                
    return questoes_aula

def main():
    print("Iniciando extração do acervo de Matemática...")
    files = sorted(list(ORIGEM_PDFS.glob("*.pdf")))
    todas_questoes = []
    
    for f in files:
        m = RE_AULA.search(f.name)
        aula_num = int(m.group(1)) if m else 0
        qs = extrair_aula(f, aula_num)
        com_g = sum(1 for q in qs if q["gabarito"])
        print(f"  Aula {aula_num:02d}: {len(qs)} questões ({com_g} com gabarito)")
        todas_questoes.extend(qs)
        
    print(f"\nTotal bruto de questões coletadas: {len(todas_questoes)}")
    
    itens_prontos = []
    corpos_map = {} # body_hash -> canonical_id
    gabaritos_map = {} # body_hash -> gabarito
    
    # 1ª passada: registrar gabaritos conhecidos por body_hash
    for q in todas_questoes:
        enunciado = " ".join(q["enunciado_linhas"]).strip()
        alts = q["alternativas"]
        if not alts and q["tipo"] == "certo_errado":
            alts = CERTO_ERRADO_ALTS
        alts_str = "".join(f"{k}:{v.strip()}" for k, v in sorted(alts.items()))
        b_hash = hashlib.sha256(f"{enunciado}::{alts_str}".encode("utf-8")).hexdigest()
        q["_body_hash"] = b_hash
        q["_enunciado"] = enunciado
        q["_alts"] = alts
        if q["gabarito"] and b_hash not in gabaritos_map:
            gabaritos_map[b_hash] = q["gabarito"]

    # 2ª passada: construir itens ricos com IDs e referências
    for q in todas_questoes:
        b_hash = q["_body_hash"]
        enunciado = q["_enunciado"]
        if not enunciado:
            continue
            
        alts = q["_alts"]
        if not alts and (q["tipo"] == "certo_errado" or q["gabarito"] in ["C", "E"]):
            alts = CERTO_ERRADO_ALTS
            q["tipo"] = "certo_errado"
        if not alts:
            alts = {
                "A": "Opção A",
                "B": "Opção B",
                "C": "Opção C",
                "D": "Opção D",
                "E": "Opção E"
            }
            
        gabarito = q["gabarito"] or gabaritos_map.get(b_hash)
        
        id_local = f"A{q['aula']:02d}-S{q['secao']:02d}-{q['numero']:03d}"
        
        canonica = corpos_map.get(b_hash, id_local)
        if b_hash not in corpos_map:
            corpos_map[b_hash] = id_local
            
        tag_info = parse_tag(q["tag_raw"])
        
        c_hash = hashlib.sha256(f"{enunciado}::{json.dumps(alts, sort_keys=True)}::{gabarito or ''}".encode("utf-8")).hexdigest()
        
        quarantined = not bool(gabarito) or len(gabarito) != 1 or gabarito not in "ABCDE"
        
        item = {
            "id_local": id_local,
            "codigo": id_local,
            "aula": q["aula"],
            "secao": q["secao"],
            "secao_tipo": q["secao_tipo"],
            "secao_rotulo": q["secao_rotulo"],
            "grupo": 1,
            "numero_na_secao": q["numero"],
            "numero_original": q["numero"],
            "tema": q["tema"],
            "assunto": q["tema"],
            "disciplina": DISCIPLINA_CANONICA,
            "alvo_apostila": ALVO_APOSTILA,
            "banca": tag_info["banca"],
            "orgao": tag_info["orgao"],
            "cargo": tag_info["cargo"],
            "ano": tag_info["ano"],
            "classificacao_tag": tag_info["classificacao"],
            "notas_da_tag": [],
            "nivel": None,
            "tipo": q["tipo"],
            "enunciado": enunciado,
            "alternativas": alts,
            "gabarito": gabarito if not quarantined else None,
            "gabarito_original": gabarito,
            "gabarito_metodo": "palavra" if q["tipo"] == "certo_errado" else "letra",
            "origem_gabarito": q["origem_gabarito"],
            "doador_gabarito": None if canonica == id_local else canonica,
            "pagina_pdf": q["p_ini"],
            "page_refs": [q["p_ini"], q["p_fim"]],
            "content_hash": c_hash,
            "body_hash": b_hash,
            "duplicata_de": canonica,
            "proveniencia": {
                "estado": "oficial_prova" if not quarantined else "revisao_pendente",
                "origem_gabarito": q["origem_gabarito"],
                "doador_gabarito": None if canonica == id_local else canonica,
                "classificacao_tag": tag_info["classificacao"],
                "tag_crua": tag_info["tag_crua"],
                "paginas": [q["p_ini"], q["p_fim"]],
                "secao": q["secao"],
                "grupo": 1,
                "numero_original": q["numero"],
                "editado_por_humano": False
            },
            "provenance_status": "oficial_prova" if not quarantined else "revisao_pendente",
            "quarantined": quarantined,
            "status": "em_revisao",
            "origin": "import",
            "resolucao_status": "pendente_geracao",
            "isPublic": False,
            "explicacao": None,
            "links": {"teoria": None, "questao": None, "fonte_pdf": None},
            "avisos": []
        }
        itens_prontos.append(item)
        
    print(f"\nTotal de itens estruturados: {len(itens_prontos)}")
    confiaveis = sum(1 for it in itens_prontos if not it["quarantined"])
    em_revisao = len(itens_prontos) - confiaveis
    print(f"  -> {confiaveis} questões com gabarito oficial confiável")
    print(f"  -> {em_revisao} questões em revisão/quarentena")
    
    DESTINO_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(DESTINO_JSON, "w", encoding="utf-8") as out_f:
        json.dump(itens_prontos, out_f, ensure_ascii=False, indent=2)
        
    print(f"Acervo gravado com sucesso em: {DESTINO_JSON} ({os.path.getsize(DESTINO_JSON):,} bytes)")

if __name__ == "__main__":
    main()
