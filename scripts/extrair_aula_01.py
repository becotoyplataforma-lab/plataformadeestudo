import os
import json
from pypdf import PdfReader

def main():
    pdf_path = os.path.join("H:", "Meu Drive", "plataforma de estudo", "cbm-rj", "portugues", "apostila", "curso-384118-aula-01-f2d1-completo.pdf")
    if not os.path.exists(pdf_path):
        pdf_path = os.path.join("public", "apostilas", "curso-384118-aula-01-f2d1-completo.pdf")
    
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"PDF not found: {pdf_path}"}))
        return

    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    
    pages_data = []
    for idx, page in enumerate(reader.pages):
        txt = page.extract_text() or ""
        pages_data.append({
            "page": idx + 1,
            "text": txt
        })
    
    out_path = os.path.join("public", "aula-01-full-text.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "total_pages": total_pages,
            "pages": pages_data
        }, f, ensure_ascii=False, indent=2)
    
    print(json.dumps({"success": True, "total_pages": total_pages, "out_path": out_path}))

if __name__ == "__main__":
    main()
