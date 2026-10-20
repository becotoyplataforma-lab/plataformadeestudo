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

def extract_toc(reader):
    # Check page 2 and 3 for TOC items
    toc = []
    text = ""
    for p_idx in [1, 2]:
        if p_idx < len(reader.pages):
            text += "\n" + (reader.pages[p_idx].extract_text() or "")
            
    # Pattern: optional dots, number), title, page
    pattern = r'(?:^|\n)\s*(?:\.{5,})?\s*(\d{1,2})\)\s*([^\n\d]+?)\s*(\d{1,3})\s*(?=\n|\Z)'
    matches = list(re.finditer(pattern, text))
    
    for m in matches:
        num = int(m.group(1))
        title = m.group(2).strip().replace(".", "").strip()
        page = int(m.group(3))
        toc.append({"num": num, "title": title, "page": page})
        
    return toc

results = []
for aula, fname in pdf_files.items():
    fpath = os.path.join(dir_apostilas, fname)
    if not os.path.exists(fpath):
        fpath = os.path.join("public", "apostilas", fname)
    if not os.path.exists(fpath):
        continue
    reader = PdfReader(fpath)
    toc = extract_toc(reader)
    results.append(f"Aula {aula} ({len(reader.pages)} pgs) -> {len(toc)} seções detectadas:")
    for item in toc:
        results.append(f"  Sec {item['num']:02d}: {item['title']} (p. {item['page']})")
    results.append("")

with open("public/toc_extracted.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(results))

print("TOC extraction test done!")
