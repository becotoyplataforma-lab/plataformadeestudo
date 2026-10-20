import re

with open("public/cleaned_sample.txt", "r", encoding="utf-8") as f:
    text = f.read()

pages = text.split("=== PÁGINA ")

output = []
for p in pages[1:]:
    p_num = p.split(" ===")[0]
    content = p.split("===\n", 1)[1] if "===\n" in p else p
    
    raw_lines = [l.strip() for l in content.split("\n")]
    tokens = [l for l in raw_lines if l]
    
    paragraphs = []
    current_p = []
    
    for t in tokens:
        current_p.append(t)
        if t.endswith((".", "!", "?", ":", "…")) and len(current_p) > 2:
            paragraphs.append(" ".join(current_p))
            current_p = []
    if current_p:
        paragraphs.append(" ".join(current_p))
        
    output.append(f"\n--- RECONSTRUCTED PAGE {p_num} ({len(paragraphs)} paragraphs) ---")
    for idx, para in enumerate(paragraphs[:6]):
        output.append(f"[{idx+1}] {para}\n")

with open("public/reconstruct_sample.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(output))
