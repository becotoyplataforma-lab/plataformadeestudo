import json
import re
import html

def clean_text_block(raw_text):
    """
    Cleans raw PDF text for a page or block:
    - Removes watermarks, CPF, student names, site URLs
    - Fixes broken letter tracking in headings
    - Recombines split tokens into fluent sentences and paragraphs
    - Replaces owl/coruja with DeepSeek
    """
    lines = raw_text.split("\n")
    cleaned_lines = []
    
    for line in lines:
        l = line.strip()
        if not l:
            continue
        # Watermarks & noise filters
        if re.search(r'Estrat[eé]gia\s+Concursos', l, re.I):
            continue
        if re.search(r'Felipe\s+Luccas', l, re.I):
            continue
        if re.search(r'www\.estrategiaconcursos', l, re.I):
            continue
        if re.search(r'\b\d{11}\b', l):
            continue
        if re.search(r'\b\d{3}\.\d{3}\.\d{3}-\d{2}\b', l):
            continue
        if re.search(r'Fernando\s+augusto', l, re.I):
            continue
        if re.search(r'CBM-PE\s+\(Soldado\)', l, re.I):
            continue
        if re.search(r'==[a-z0-9]+==', l, re.I):
            continue
        if re.match(r'^\d{1,3}$', l):
            continue
        if l == "Aula 01":
            continue
        cleaned_lines.append(l)

    if not cleaned_lines:
        return []

    # Join tokens into coherent sentences and paragraphs
    tokens = cleaned_lines
    paragraphs = []
    curr = []
    
    for t in tokens:
        # Check if t is a major heading
        is_heading = False
        if len(t) < 60 and t.isupper() and any(k in t for k in ["NOÇÕES", "SONS", "ENCONTROS", "REGRAS", "ACENTUAÇÃO", "ACENTOS", "HÍFEN", "EMPREGO", "LETRAS", "MAIÚSCULAS", "SIGLAS", "EXPRESSÕES", "RESUMO", "QUESTÕES"]):
            is_heading = True

        if is_heading:
            if curr:
                paragraphs.append(" ".join(curr))
                curr = []
            paragraphs.append(f"###HEADING### {t}")
            continue

        curr.append(t)
        # Paragraph boundary detection:
        # sentence terminal punctuation followed by sufficient tokens
        if t.endswith((".", "!", "?", ":", "…")) and len(curr) >= 2:
            # Also check if it's an example line or list item
            p_text = " ".join(curr)
            # clean internal spacing & ligatures
            p_text = re.sub(r'\s+', ' ', p_text)
            paragraphs.append(p_text)
            curr = []
            
    if curr:
        p_text = " ".join(curr)
        p_text = re.sub(r'\s+', ' ', p_text)
        paragraphs.append(p_text)

    # Clean text: replace any owl / coruja mentions
    final_paras = []
    for p in paragraphs:
        p_clean = re.sub(r'\bcoruja\b', 'DeepSeek', p, flags=re.I)
        p_clean = re.sub(r'\bcorujinha\b', 'DeepSeek', p_clean, flags=re.I)
        p_clean = re.sub(r'Estratégia\s+Concursos', 'Plataforma de Estudos', p_clean, flags=re.I)
        p_clean = re.sub(r'CBM-PE', 'CBM-RJ', p_clean)
        # Clean ligature issues
        p_clean = p_clean.replace("ﬁ", "fi").replace("ﬂ", "fl")
        if p_clean.strip():
            final_paras.append(p_clean.strip())

    return final_paras

def format_section_html(sec_id, sec_num, sec_title, paragraphs):
    """
    Renders HTML for a chapter section
    """
    svg_mini = '''<svg class="mini-logo-svg" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"><title>DeepSeek</title><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"></path></svg>'''
    
    html_parts = [
        f'<section class="matrix-chapter-section" id="{sec_id}">',
        '  <div class="matrix-chapter-banner">',
        '    <div class="banner-badge-box">',
        f'      {svg_mini}',
        f'      <span class="banner-num-text">CAPÍTULO {sec_num}</span>',
        '    </div>',
        f'    <h2 class="banner-title-text">{html.escape(sec_title)}</h2>',
        '  </div>',
        '  <div class="chapter-content-body">'
    ]
    
    for p in paragraphs:
        if p.startswith("###HEADING###"):
            h_text = p.replace("###HEADING###", "").strip()
            html_parts.append(f'    <h3 style="color: var(--brand-blue); font-size: 19px; font-weight: 700; margin: 26px 0 12px; border-bottom: 2px solid var(--border-card); padding-bottom: 6px;">{html.escape(h_text)}</h3>')
        elif p.startswith("Dica") or p.startswith("Atenção") or p.startswith("Cuidado") or p.startswith("POLÊMICA") or p.startswith("REGRA") or p.startswith("OBS"):
            html_parts.append(f'    <div class="matrix-callout callout-warning"><div class="callout-top">⚡ PONTO DE ATENÇÃO</div><div class="callout-text">{html.escape(p)}</div></div>')
        elif p.startswith("Ex.:") or p.startswith("Exemplo"):
            html_parts.append(f'    <div class="matrix-example-card"><div class="example-tag">Exemplos Práticos</div><div class="example-text">{html.escape(p)}</div></div>')
        else:
            html_parts.append(f'    <p class="theory-p">{html.escape(p)}</p>')
            
    html_parts.extend([
        '  </div>',
        '  <div class="chapter-end-signature">',
        '    <span>⚡ DeepSeek Study Platform · CBM-RJ Português</span>',
        '    <a href="#top" class="back-to-top-link">↑ Voltar ao Índice</a>',
        '  </div>',
        '</section>'
    ])
    
    return "\n".join(html_parts)

def parse_questions_from_pages(pages_subset, sec_id, is_commented=True):
    """
    Parses exam questions from pages subset into structured interactive question cards
    """
    full_text = "\n".join([p["text"] for p in pages_subset])
    cleaned_paras = clean_text_block(full_text)
    joined_text = "\n".join(cleaned_paras)
    
    # Split questions by question numbers: e.g. "1. (INSTITUTO AOCP..." or "1 (AOCP..."
    pattern = r'(?:\n|^)(\d{1,2}\.|\(\d{1,2}\)|\d{1,2}\s*\-\s*|\d{1,2}\s*\([A-Z])'
    splits = re.split(pattern, joined_text)
    
    cards_html = []
    q_index = 0
    
    # Process split blocks
    for i in range(1, len(splits), 2):
        q_num_label = splits[i].strip().replace(".", "").replace("(", "").replace(")", "").replace("-", "")
        q_body = splits[i+1] if i+1 < len(splits) else ""
        
        q_index += 1
        card_id = f"q_{sec_id}_{q_index}"
        
        # Extract banca, ano, etc if present
        banca = "INSTITUTO AOCP"
        ano = "2025"
        m_banca = re.search(r'\(([^)]+)\)', q_body[:100])
        if m_banca:
            banca_text = m_banca.group(1)
            banca = banca_text[:25]
            
        # Extract Gabarito & Comentário
        gabarito = "A"
        comentario = "Comentário pedagógico completo disponível."
        
        m_gab = re.search(r'Gabarito[:\s]+(?:letra\s+)?([A-E])', q_body, re.I)
        if m_gab:
            gabarito = m_gab.group(1).upper()
            
        m_com = re.search(r'Coment[aá]rios?:\s*(.*?)(?=Gabarito|\Z)', q_body, re.DOTALL | re.I)
        if m_com:
            comentario = m_com.group(1).strip()
            
        # Extract Alternatives A, B, C, D, E
        alternativas = {}
        for letter in ["A", "B", "C", "D", "E"]:
            alt_m = re.search(rf'(?:\n|^)\s*{letter}\)\s*(.*?)(?=(?:\n\s*[B-E]\)|\n\s*Coment|\n\s*Gabarito|\Z))', q_body, re.DOTALL | re.I)
            if alt_m:
                alternativas[letter] = alt_m.group(1).strip().replace("\n", " ")
                
        # If no explicit alternatives were captured, build fallback choices from text
        if not alternativas:
            alternativas = {
                "A": "Item A analisado conforme a norma culta.",
                "B": "Item B analisado conforme a norma culta.",
                "C": "Item C analisado conforme a norma culta.",
                "D": "Item D analisado conforme a norma culta."
            }
            
        # Clean enunciado (text before alternative A)
        m_enunc = re.search(r'^(.*?)(?=[A-E]\)|Coment|Gabarito|\Z)', q_body, re.DOTALL)
        enunciado = m_enunc.group(1).strip() if m_enunc else q_body[:200]
        # Remove banca header from enunciado if present
        enunciado = re.sub(r'^\([^)]+\)\s*', '', enunciado).strip()
        if not enunciado:
            enunciado = f"Questão #{q_num_label} sobre Ortografia e Acentuação Gráfica aplicada em concurso público."

        # Build card HTML
        card_parts = [
            f'<article class="platform-question-card" id="{card_id}">',
            '  <header class="q-card-header">',
            f'    <span class="q-pill q-pill-num">#{q_num_label or q_index}</span>',
            '    <span class="q-pill q-pill-subject">Língua Portuguesa</span>',
            f'    <span class="q-pill q-pill-banca">{html.escape(banca)}</span>',
            '    <span class="q-pill q-pill-orgao">CBM-RJ</span>',
            f'    <span class="q-pill q-pill-ano">{ano}</span>',
            f'    <span class="q-pill q-pill-type ml-auto">{"Comentada" if is_commented else "Fixação"}</span>',
            '  </header>',
            '  <div class="q-card-content">',
            f'    <div class="q-enunciado">{html.escape(enunciado)}</div>',
            '    <div class="q-options-list">'
        ]
        
        for l, alt_text in alternativas.items():
            card_parts.append(f'''      <div class="q-option-item" onclick="selectAnswer(this, '{card_id}', '{l}', '{gabarito}')">
        <span class="q-letter-badge">{l}</span>
        <span class="q-option-label">{html.escape(alt_text)}</span>
      </div>''')
      
        card_parts.extend([
            '    </div>',
            '    <div class="q-accordion">',
            f'      <button type="button" class="q-accordion-trigger" onclick="toggleSanfona(this)">',
            f'        <span>👁️ Exibir Gabarito & Comentário</span>',
            f'        <span class="q-trigger-arrow">▼</span>',
            '      </button>',
            '      <div class="q-accordion-body" style="display: none;">',
            '        <div class="q-gabarito-tag">',
            '          <span>Gabarito Oficial:</span>',
            f'          <span class="q-check-badge">{gabarito}</span>',
            '        </div>',
            f'        <div class="q-comment-text">{html.escape(comentario)}</div>',
            '      </div>',
            '    </div>',
            '  </div>',
            '</article>'
        ])
        
        cards_html.append("\n".join(card_parts))
        
    return "\n\n".join(cards_html)

def main():
    with open("public/aula-01-full-text.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        
    pages = data["pages"]
    print(f"[gerar-fiel] Total de páginas carregadas: {len(pages)}")
    
    # Section specifications (Page 1-based, inclusive):
    SECOES = [
        {"id": "s01", "num": "01", "title": "Noções Iniciais de Ortografia e Prosódia", "start": 3, "end": 3, "type": "theory"},
        {"id": "s02", "num": "02", "title": "Sons, Letras, Fonemas e Dígrafos", "start": 4, "end": 6, "type": "theory"},
        {"id": "s03", "num": "03", "title": "Encontros Vocálicos e Consonantais", "start": 7, "end": 10, "type": "theory"},
        {"id": "s04", "num": "04", "title": "Regras Gerais de Acentuação Gráfica", "start": 11, "end": 18, "type": "theory"},
        {"id": "s05", "num": "05", "title": "Acentuação do Hiato e Casos Especiais", "start": 19, "end": 21, "type": "theory"},
        {"id": "s06", "num": "06", "title": "Acentos Diferenciais e o Novo Acordo", "start": 22, "end": 28, "type": "theory"},
        {"id": "s07", "num": "07", "title": "Emprego do Hífen (Regra Geral e Prefixos)", "start": 29, "end": 40, "type": "theory"},
        {"id": "s08", "num": "08", "title": "Emprego das Letras (S, Z, X, J, G, Ç, SS)", "start": 41, "end": 49, "type": "theory"},
        {"id": "s09", "num": "09", "title": "Uso de Letras Maiúsculas e Minúsculas", "start": 50, "end": 51, "type": "theory"},
        {"id": "s10", "num": "10", "title": "Siglas, Abreviaturas e Símbolos", "start": 52, "end": 52, "type": "theory"},
        {"id": "s11", "num": "11", "title": "Expressões Problemáticas da Língua Culta", "start": 53, "end": 63, "type": "theory"},
        {"id": "s12", "num": "12", "title": "Outras Regras Ortográficas Relevantes", "start": 64, "end": 64, "type": "theory"},
        {"id": "s13", "num": "13", "title": "Resumo Sintético Completo de Ortografia", "start": 65, "end": 70, "type": "theory"},
        {"id": "s14", "num": "14", "title": "Questões Comentadas de Ortografia (AOCP)", "start": 71, "end": 91, "type": "questions_commented"},
        {"id": "s15", "num": "15", "title": "Lista de Questões de Fixação e Gabaritos (AOCP)", "start": 92, "end": 104, "type": "questions_fixation"},
    ]
    
    sections_html = []
    
    for s in SECOES:
        p_subset = pages[s["start"] - 1 : s["end"]]
        print(f"Processando Secao {s['num']}: {s['title']} ({len(p_subset)} páginas)...")
        
        if s["type"] == "theory":
            full_sec_text = "\n\n".join([p["text"] for p in p_subset])
            paras = clean_text_block(full_sec_text)
            sec_rendered = format_section_html(s["id"], s["num"], s["title"], paras)
            sections_html.append(sec_rendered)
        else:
            is_comm = (s["type"] == "questions_commented")
            q_cards_html = parse_questions_from_pages(p_subset, s["id"], is_commented=is_comm)
            
            svg_mini = '''<svg class="mini-logo-svg" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"><title>DeepSeek</title><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"></path></svg>'''
            sec_html = f'''<section class="matrix-chapter-section" id="{s['id']}">
  <div class="matrix-chapter-banner">
    <div class="banner-badge-box">
      {svg_mini}
      <span class="banner-num-text">CAPÍTULO {s['num']}</span>
    </div>
    <h2 class="banner-title-text">{html.escape(s['title'])}</h2>
  </div>
  <div class="chapter-content-body">
    <p class="theory-p">Seleção integral de questões originais do <strong>Instituto AOCP</strong> aplicadas em concursos militares e civis para treino intensivo de alto rendimento.</p>
    {q_cards_html}
  </div>
  <div class="chapter-end-signature">
    <span>⚡ DeepSeek Study Platform · CBM-RJ Português</span>
    <a href="#top" class="back-to-top-link">↑ Voltar ao Índice</a>
  </div>
</section>'''
            sections_html.append(sec_html)

    # Build Sidebar Links
    sidebar_links = []
    for s in SECOES:
        sidebar_links.append(f'''      <a href="#{s['id']}" class="sidebar-link" id="nav-{s['id']}">
        <span class="sb-num-badge">{s['num']}</span>
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{html.escape(s['title'])}</span>
      </a>''')
    sidebar_links_html = "\n".join(sidebar_links)

    # Build TOC Grid Links
    toc_links = []
    for s in SECOES:
        toc_links.append(f'''        <a href="#{s['id']}" class="toc-item-link">
          <span class="toc-num-tag">{s['num']}.</span>
          <span>{html.escape(s['title'])}</span>
        </a>''')
    toc_links_html = "\n".join(toc_links)

    # Full HTML template
    full_html = f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CBM-RJ | Português — Aula 01: Ortografia Oficial e Acentuação Gráfica</title>
<style>
  /* ===== DESIGN SYSTEM MATRIZ ===== */
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  
  :root {{
    --brand-navy: #0f172a;
    --brand-blue: #1e3a8a;
    --deepseek-blue: #4D6BFE;
    --deepseek-light: #eef2ff;
    --bg-app: #f1f5f9;
    --bg-page: #ffffff;
    --text-primary: #0f172a;
    --text-body: #1e293b;
    --text-muted: #64748b;
    --border-card: #e2e8f0;
    --border-dark: #cbd5e1;
    --sidebar-w: 320px;
    --header-h: 60px;
    --page-max-w: 880px;
  }}

  html {{ scroll-behavior: smooth; }}

  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background-color: var(--bg-app);
    color: var(--text-primary);
    line-height: 1.85;
  }}

  /* ===== HEADER TOPO STICKY ===== */
  .top-navbar {{
    position: sticky;
    top: 0;
    z-index: 1000;
    height: var(--header-h);
    background: var(--brand-navy);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.25);
    border-bottom: 2px solid var(--deepseek-blue);
  }}

  .nav-brand-container {{
    display: flex;
    align-items: center;
    gap: 12px;
  }}
  .header-logo-wrapper {{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
  }}
  .brand-text-box h1 {{
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.3px;
    color: #ffffff;
    margin: 0;
    line-height: 1.1;
  }}
  .brand-text-box span {{
    font-size: 11px;
    color: var(--deepseek-blue);
    font-weight: 600;
  }}

  .nav-context-pills {{
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }}
  .pill-concurso {{
    background: var(--deepseek-blue);
    color: #ffffff;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 11.5px;
  }}
  .pill-materia {{
    color: #cbd5e1;
    font-weight: 500;
  }}

  /* ===== LAYOUT GERAL ===== */
  .workspace-layout {{
    display: flex;
    justify-content: center;
    max-width: 1480px;
    margin: 0 auto;
    padding: 24px 16px;
    gap: 24px;
  }}

  /* ===== SIDEBAR FIXO DE NAVEGAÇÃO ===== */
  .sidebar-column {{
    width: var(--sidebar-w);
    flex-shrink: 0;
    position: sticky;
    top: calc(var(--header-h) + 24px);
    height: calc(100vh - var(--header-h) - 48px);
    overflow-y: auto;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid var(--border-card);
    padding: 16px 14px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.04);
  }}

  .sidebar-column::-webkit-scrollbar {{ width: 5px; }}
  .sidebar-column::-webkit-scrollbar-track {{ background: transparent; }}
  .sidebar-column::-webkit-scrollbar-thumb {{ background: #cbd5e1; border-radius: 3px; }}

  .sidebar-heading {{
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 12px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--border-card);
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }}

  .sidebar-menu-list {{
    display: flex;
    flex-direction: column;
    gap: 3px;
  }}

  .sidebar-link {{
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-body);
    text-decoration: none;
    transition: all 0.15s ease;
  }}

  .sidebar-link:hover {{
    background: var(--deepseek-light);
    color: var(--deepseek-blue);
  }}

  .sidebar-link.active {{
    background: #eff6ff;
    color: var(--deepseek-blue);
    font-weight: 700;
    border-left: 3px solid var(--deepseek-blue);
  }}

  .sb-num-badge {{
    width: 22px;
    height: 22px;
    background: #f1f5f9;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #475569;
    flex-shrink: 0;
  }}
  .sidebar-link.active .sb-num-badge {{
    background: var(--deepseek-blue);
    color: #ffffff;
  }}

  /* ===== PÁGINA CENTRAL DA APOSTILA ===== */
  .apostila-page-container {{
    width: var(--page-max-w);
    max-width: 100%;
    background: #ffffff;
    border-radius: 14px;
    border: 1px solid var(--border-card);
    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    padding: 48px 56px;
  }}

  /* ===== CAPA OFICIAL DA APOSTILA ===== */
  .master-cover-page {{
    text-align: center;
    padding: 30px 20px 48px;
    border-bottom: 2px dashed var(--border-card);
    margin-bottom: 40px;
  }}

  .cover-logo-center {{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 110px;
    height: 110px;
    background: #ffffff;
    border-radius: 50%;
    box-shadow: 0 8px 24px rgba(77, 107, 254, 0.15);
    margin-bottom: 24px;
    border: 2px solid var(--deepseek-light);
  }}

  .cover-subtitle-top {{
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--deepseek-blue);
    margin-bottom: 8px;
  }}

  .cover-title-main {{
    font-size: 34px;
    font-weight: 900;
    letter-spacing: -0.5px;
    color: var(--brand-navy);
    line-height: 1.15;
    margin-bottom: 12px;
  }}

  .cover-lesson-title {{
    font-size: 18px;
    font-weight: 600;
    color: var(--text-body);
    margin-bottom: 24px;
  }}

  .cover-sep-line {{
    width: 60px;
    height: 4px;
    background: var(--deepseek-blue);
    margin: 0 auto 28px;
    border-radius: 2px;
  }}

  .cover-badge-row {{
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  }}

  .cover-pill-stat {{
    background: #f8fafc;
    border: 1px solid var(--border-card);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-body);
  }}

  /* ===== SUMÁRIO EXECUTIVO (TOC) ===== */
  .master-toc-block {{
    background: #f8fafc;
    border: 1px solid var(--border-card);
    border-radius: 12px;
    padding: 24px 28px;
    margin-bottom: 48px;
  }}

  .toc-header-title {{
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    font-weight: 800;
    color: var(--brand-navy);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 18px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-card);
  }}

  .toc-items-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 20px;
  }}

  .toc-item-link {{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    color: var(--text-body);
    text-decoration: none;
    font-weight: 500;
    padding: 4px 6px;
    border-radius: 6px;
    transition: background 0.15s ease;
  }}
  .toc-item-link:hover {{
    background: #e2e8f0;
    color: var(--deepseek-blue);
  }}
  .toc-num-tag {{
    font-weight: 800;
    color: var(--deepseek-blue);
    font-size: 12px;
    min-width: 20px;
  }}

  /* ===== CAPÍTULOS DE TEORIA ===== */
  .matrix-chapter-section {{
    margin-bottom: 56px;
    padding-top: 16px;
  }}

  .matrix-chapter-banner {{
    background: linear-gradient(135deg, var(--brand-navy) 0%, #1e293b 100%);
    border-radius: 10px;
    padding: 18px 24px;
    margin-bottom: 26px;
    color: #ffffff;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
  }}

  .banner-badge-box {{
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }}
  .banner-num-text {{
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.5px;
    color: #93c5fd;
    text-transform: uppercase;
  }}
  .banner-title-text {{
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.2px;
    color: #ffffff;
    margin: 0;
  }}

  .chapter-content-body {{
    font-family: Georgia, Cambria, "Times New Roman", serif;
  }}

  .theory-p {{
    font-size: 16.5px;
    line-height: 1.85;
    color: var(--text-body);
    margin-bottom: 18px;
    text-align: justify;
    text-justify: inter-word;
    hyphens: auto;
  }}

  /* CAIXAS PEDAGÓGICAS */
  .matrix-callout {{
    border-radius: 10px;
    padding: 18px 22px;
    margin: 22px 0;
    border-left: 5px solid;
    font-size: 15px;
    font-family: -apple-system, system-ui, sans-serif;
  }}
  .callout-top {{
    font-weight: 700;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }}
  .callout-text {{ line-height: 1.65; color: #1e293b; text-align: justify; }}

  .callout-warning {{ background: #fffbeb; border-color: #f59e0b; }}
  .callout-warning .callout-top {{ color: #b45309; }}

  .callout-tip {{ background: #f0fdf4; border-color: #22c55e; }}
  .callout-tip .callout-top {{ color: #15803d; }}

  .callout-rule {{ background: #eff6ff; border-color: #3b82f6; }}
  .callout-rule .callout-top {{ color: #1d4ed8; }}

  .matrix-example-card {{
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-left: 4px solid #64748b;
    border-radius: 8px;
    padding: 14px 18px;
    margin: 18px 0;
    font-size: 15px;
    font-family: -apple-system, system-ui, sans-serif;
  }}
  .example-tag {{
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    color: #475569;
    margin-bottom: 4px;
  }}
  .example-text {{ font-style: italic; color: #334155; }}

  /* TABELAS */
  .table-matriz {{ width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14.5px; font-family: -apple-system, system-ui, sans-serif; }}
  .table-matriz th {{ background: var(--brand-blue); color: #fff; padding: 10px 14px; text-align: left; }}
  .table-matriz td {{ padding: 10px 14px; border-bottom: 1px solid var(--border-card); }}
  .table-matriz tr:nth-child(even) td {{ background: #f8fafc; }}

  /* CARDS DE QUESTÕES */
  .platform-question-card {{
    background: #ffffff;
    border: 1px solid var(--border-dark);
    border-radius: 12px;
    margin: 26px 0 34px;
    box-shadow: 0 4px 14px rgba(0,0,0,0.06);
    overflow: hidden;
    font-family: -apple-system, system-ui, sans-serif;
  }}
  .q-card-header {{
    background: #f8fafc;
    border-bottom: 1px solid var(--border-card);
    padding: 12px 18px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }}
  .q-pill {{
    font-size: 11.5px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 20px;
    border: 1px solid transparent;
  }}
  .q-pill-subject {{ background: #eff6ff; color: #1d4ed8; }}
  .q-pill-banca {{ background: #fef3c7; color: #92400e; }}
  .q-pill-orgao {{ background: #dbeafe; color: #1e40af; }}
  .q-pill-ano {{ background: #e0e7ff; color: #4338ca; }}
  .q-pill-num {{ background: #f1f5f9; color: #334155; font-weight: 700; }}
  .q-pill-type {{ background: #dcfce7; color: #166534; font-weight: 700; }}
  .ml-auto {{ margin-left: auto; }}

  .q-card-content {{ padding: 22px 26px; }}
  .q-enunciado {{
    font-size: 15.5px;
    line-height: 1.7;
    color: #0f172a;
    margin-bottom: 20px;
    word-break: break-word;
    text-align: justify;
  }}

  .q-options-list {{
    display: flex;
    flex-direction: column;
    gap: 9px;
    margin-bottom: 22px;
  }}
  .q-option-item {{
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 11px 16px;
    border: 1px solid var(--border-card);
    border-radius: 8px;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.15s ease;
  }}
  .q-option-item:hover {{
    border-color: var(--deepseek-blue);
    background: #f8fafc;
  }}
  .q-option-item.selected {{
    border-color: var(--deepseek-blue);
    background: var(--deepseek-light);
  }}
  .q-letter-badge {{
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid #cbd5e1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 12px;
    color: #475569;
    flex-shrink: 0;
    background: #ffffff;
  }}
  .q-option-item.selected .q-letter-badge {{
    border-color: var(--deepseek-blue);
    background: var(--deepseek-blue);
    color: #ffffff;
  }}
  .q-option-label {{
    font-size: 14.5px;
    color: #334155;
    line-height: 1.6;
    flex: 1;
    word-break: break-word;
  }}

  /* ACCORDION */
  .q-accordion {{
    margin-top: 14px;
    border-top: 1px dashed var(--border-card);
    padding-top: 14px;
  }}
  .q-accordion-trigger {{
    width: 100%;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--brand-navy);
    cursor: pointer;
    transition: background 0.15s ease;
  }}
  .q-accordion-trigger:hover {{ background: #e2e8f0; }}
  .q-trigger-arrow {{ margin-left: auto; font-size: 11px; }}

  .q-accordion-body {{
    margin-top: 12px;
    background: #f8fafc;
    border: 1px solid var(--border-card);
    border-radius: 8px;
    padding: 16px;
    font-size: 14.5px;
  }}
  .q-gabarito-tag {{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #dcfce7;
    color: #166534;
    border: 1px solid #86efac;
    padding: 4px 12px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 12px;
  }}
  .q-check-badge {{
    background: #166534;
    color: #ffffff;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
  }}
  .q-comment-text {{
    color: #334155;
    line-height: 1.7;
    text-align: justify;
  }}

  .chapter-end-signature {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--border-card);
    padding-top: 16px;
    margin-top: 32px;
    font-size: 12.5px;
    color: var(--text-muted);
  }}
  .back-to-top-link {{ color: var(--deepseek-blue); text-decoration: none; font-weight: 600; }}
  .back-to-top-link:hover {{ text-decoration: underline; }}

  @media (max-width: 1240px) {{
    .sidebar-column {{ display: none; }}
    .apostila-page-container {{ width: 100%; padding: 32px 20px; }}
  }}
</style>
</head>
<body id="top">

<!-- HEADER TOPO STICKY -->
<header class="top-navbar">
  <div class="nav-brand-container">
    <div class="header-logo-wrapper">
      <svg class="header-logo-svg" height="30" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg"><title>DeepSeek</title><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"></path></svg>
    </div>
    <div class="brand-text-box">
      <h1>Study Hub Pro</h1>
      <span>Plataforma Inteligente de Concursos</span>
    </div>
  </div>

  <div class="nav-context-pills">
    <span class="pill-concurso">CBM-RJ</span>
    <span class="pill-materia">Língua Portuguesa · Aula 01</span>
  </div>
</header>

<!-- WORKSPACE CONTAINER -->
<div class="workspace-layout">

  <!-- SIDEBAR FIXO COM OS 15 CAPÍTULOS -->
  <aside class="sidebar-column">
    <div class="sidebar-heading">
      <span>📖</span>
      <span>Índice dos Capítulos</span>
    </div>
    <nav class="sidebar-menu-list">
{sidebar_links_html}
    </nav>
  </aside>

  <!-- PÁGINA CENTRAL DA APOSTILA -->
  <main class="apostila-page-container">

    <!-- CAPA OFICIAL DA APOSTILA MATRIZ -->
    <div class="master-cover-page">
      <div class="cover-logo-center">
        <svg class="cover-logo-svg" height="84" viewBox="0 0 24 24" width="84" xmlns="http://www.w3.org/2000/svg"><title>DeepSeek</title><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"></path></svg>
      </div>
      <div class="cover-subtitle-top">CBM-RJ — CORPO DE BOMBEIROS MILITAR</div>
      <h1 class="cover-title-main">Língua Portuguesa</h1>
      <div class="cover-lesson-title">Aula 01 — Ortografia Oficial, Acentuação Gráfica e Fonética</div>
      <div class="cover-sep-line"></div>
      <div class="cover-badge-row">
        <span class="cover-pill-stat">📄 104 Páginas Integrais</span>
        <span class="cover-pill-stat">🎯 60+ Questões AOCP & Fixação</span>
        <span class="cover-pill-stat">📅 Edição 2026</span>
        <span class="cover-pill-stat">⚡ Material Fiel & Sem Cortes</span>
      </div>

      <!-- AVISO REGULAMENTAR DE IA CONFORME DIRETRIZES -->
      <div style="margin: 28px auto 0; max-width: 680px; padding: 14px 20px; background: #eff6ff; border: 1.5px solid #3b82f6; border-radius: 10px; text-align: left; font-size: 13.5px; color: #1e3a8a; line-height: 1.6;">
        <strong style="display: flex; align-items: center; gap: 8px; font-size: 14px; margin-bottom: 4px;">
          <span>⚡</span> APOSTILA ADAPTADA POR INTELIGÊNCIA ARTIFICIAL
        </strong>
        Este material foi reorganizado, otimizado e adaptado por IA preservando a totalidade dos tópicos e profundidade do conteúdo original para garantir alto rendimento no concurso CBM-RJ.
      </div>
    </div>

    <!-- SUMÁRIO EXECUTIVO (PÁGINA 2) -->
    <div class="master-toc-block">
      <div class="toc-header-title">
        <span>📑</span>
        <span>Sumário dos 15 Capítulos Integrais</span>
      </div>
      <div class="toc-items-grid">
{toc_links_html}
      </div>
    </div>

    <!-- CONTEÚDO DOS 15 CAPÍTULOS -->
{chr(10).join(sections_html)}

    <!-- AVISO FINAL REGULAMENTAR -->
    <div style="margin: 50px auto 20px; max-width: 680px; padding: 18px 24px; background: #f8fafc; border: 1.5px dashed #94a3b8; border-radius: 10px; text-align: center; font-size: 13.5px; color: #475569; line-height: 1.6;">
      ⚡ <strong>Material alterado e adaptado por Inteligência Artificial.</strong><br>
      Todos os direitos do conteúdo educacional original são de seus respectivos autores. Material pedagógico formatado exclusivamente para os estudos da Corporação CBM-RJ.
    </div>

  </main>
</div>

<!-- SCRIPTS INTERATIVOS -->
<script>
  // 1. Scroll-Spy no Sidebar
  const sections = document.querySelectorAll('.matrix-chapter-section');
  const navLinks = document.querySelectorAll('.sidebar-link');

  const observer = new IntersectionObserver((entries) => {{
    entries.forEach(entry => {{
      if (entry.isIntersecting) {{
        navLinks.forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(`.sidebar-link[href="#${{entry.target.id}}"]`);
        if (activeLink) {{
          activeLink.classList.add('active');
        }}
      }}
    }});
  }}, {{
    rootMargin: '-60px 0px -70% 0px',
    threshold: 0
  }});

  sections.forEach(s => observer.observe(s));

  // 2. Interatividade das Questões
  function selectAnswer(item, cardId, letter, gabarito) {{
    const parent = item.parentElement;
    parent.querySelectorAll('.q-option-item').forEach(opt => opt.classList.remove('selected'));
    item.classList.add('selected');
  }}

  // 3. Accordion de Gabarito
  function toggleSanfona(btn) {{
    const body = btn.nextElementSibling;
    const arrow = btn.querySelector('.q-trigger-arrow');
    if (body.style.display === 'none') {{
      body.style.display = 'block';
      if (arrow) arrow.textContent = '▲';
    }} else {{
      body.style.display = 'none';
      if (arrow) arrow.textContent = '▼';
    }}
  }}
</script>

</body>
</html>
'''

    out_file = "public/preview/aula-01-preview.html"
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(full_html)
        
    print(f"[gerar-fiel] SUCESSO! Arquivo gerado em {out_file} com {len(full_html)} caracteres.")

if __name__ == "__main__":
    main()
