import json

with open("public/aula-01-full-text.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Inspect page 71 (start of Questões Comentadas)
p71 = data["pages"][70]["text"]
p72 = data["pages"][71]["text"]

# Inspect page 92 (start of Lista de Questões)
p92 = data["pages"][91]["text"]

with open("public/questoes_sample.txt", "w", encoding="utf-8") as f:
    f.write("=== PAGE 71 ===\n" + p71 + "\n\n=== PAGE 72 ===\n" + p72 + "\n\n=== PAGE 92 ===\n" + p92)

print("Wrote questoes_sample.txt")
