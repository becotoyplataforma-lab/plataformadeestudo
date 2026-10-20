import json

with open("public/aula-01-full-text.json", "r", encoding="utf-8") as f:
    data = json.load(f)

p3 = data["pages"][2]["text"]
print("Length of page 3:", len(p3))
print("Repr of first 300 chars:")
print(repr(p3[:300]))
