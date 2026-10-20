import json
import re

with open("public/aula-01-full-text.json", "r", encoding="utf-8") as f:
    data = json.load(f)

def clean_page_text(raw_text):
    lines = raw_text.split("\n")
    cleaned_lines = []
    
    for line in lines:
        l = line.strip()
        # Filter watermarks & headers/footers
        if not l:
            cleaned_lines.append("")
            continue
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
        if re.match(r'^\d{1,3}$', l): # page number like 3, 104
            continue
        if l == "Aula 01":
            continue
        cleaned_lines.append(line)
        
    text = "\n".join(cleaned_lines)
    
    # Fix heading broken tracking (e.g. N\nOÇÕES -> NOÇÕES)
    text = re.sub(r'([A-ZÀ-Ú])\n([A-ZÀ-Ú])', r'\1\2', text)
    
    # Collapse multiple spaces but preserve line breaks
    text = re.sub(r'[ \t]+', ' ', text)
    
    # Normalize excessive newlines
    text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
    
    # Clean whitespace before punctuation
    text = re.sub(r'\s+([,.:;?!])', r'\1', text)
    
    return text.strip()

out_samples = []
for p in [3, 4, 7, 11, 19, 22]:
    raw = data["pages"][p - 1]["text"]
    cleaned = clean_page_text(raw)
    out_samples.append(f"=== PÁGINA {p} ===\n{cleaned}\n")

with open("public/cleaned_sample.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out_samples))

print("Samples written to public/cleaned_sample.txt")
