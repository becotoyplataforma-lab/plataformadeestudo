import json
import re

with open("public/aula-01-full-text.json", "r", encoding="utf-8") as f:
    data = json.load(f)

pages = data["pages"]
print(f"Total pages: {len(pages)}")

# Print sample from page 7 (Section 3: Encontros Vocálicos)
p7 = pages[6]["text"]
print("\n--- SAMPLE PAGE 7 ---")
print(p7[:500])

# Print sample from page 29 (Section 7: Emprego do Hífen)
p29 = pages[28]["text"]
print("\n--- SAMPLE PAGE 29 ---")
print(p29[:500])

# Print sample from page 71 (Section 14: Questões Comentadas)
p71 = pages[70]["text"]
print("\n--- SAMPLE PAGE 71 ---")
print(p71[:500])
