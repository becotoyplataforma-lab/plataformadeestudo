import os
import re
from pypdf import PdfReader

dir_apostilas = os.path.join("H:", "Meu Drive", "plataforma de estudo", "cbm-rj", "portugues", "apostila")

pdf_files = {
    "02": "curso-384118-aula-02-937a-completo.pdf",
    "03": "curso-384118-aula-03-f129-completo.pdf",
    "04": "curso-384118-aula-04-6fe6-completo.pdf",
    "05": "curso-384118-aula-05-5077-completo.pdf",
    "06": "curso-384118-aula-06-15f7-completo.pdf",
    "07": "curso-384118-aula-07-3752-completo.pdf",
    "08": "curso-384118-aula-08-a7e5-completo.pdf",
    "09": "curso-384118-aula-09-a7c3-completo.pdf",
    "10": "curso-384118-aula-10-8788-completo.pdf",
    "11": "curso-384118-aula-11-a3e2-completo.pdf",
    "12": "curso-384118-aula-12-2fe8-completo.pdf",
    "13": "curso-384118-aula-13-70e8-completo.pdf",
}

results = []

for aula, fname in pdf_files.items():
    fpath = os.path.join(dir_apostilas, fname)
    if not os.path.exists(fpath):
        fpath = os.path.join("public", "apostilas", fname)
    if not os.path.exists(fpath):
        results.append(f"Aula {aula}: ARQUIVO NAO ENCONTRADO ({fname})")
        continue
    
    reader = PdfReader(fpath)
    total_p = len(reader.pages)
    
    # Extract page 2 text (index)
    idx_text = ""
    if total_p >= 2:
        idx_text = reader.pages[1].extract_text() or ""
        # clean line breaks in index
        idx_lines = [l.strip() for l in idx_text.split("\n") if l.strip()]
        # find lines starting with number or dot
        toc_lines = [l for l in idx_lines if re.search(r'\d+\)', l) or "Índice" in l or "SUMÁRIO" in l or re.search(r'\d+\s*$', l)]
    
    # Extract title from page 1
    p1_text = reader.pages[0].extract_text() if total_p >= 1 else ""
    m_title = re.search(r'Aula\s+\d+.*?(?=Autor|\nAutor|\Z)', p1_text, re.DOTALL | re.I)
    title = m_title.group(0).replace("\n", " ").strip() if m_title else f"Aula {aula}"
    
    results.append(f"=== AULA {aula} ({total_p} páginas) - {title} ===")
    results.append("TOC RESUMO:")
    results.append("\n".join(toc_lines[:15]))
    results.append("\n" + "="*50 + "\n")

with open("public/todas_aulas_info.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(results))

print("Inspecao concluida com sucesso!")
