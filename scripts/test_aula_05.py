import os
import sys
import traceback
from pypdf import PdfReader

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

import scripts.processar_todas_apostilas_fiel as proc

cfg = proc.PDF_FILES["05"]
fpath = os.path.join(proc.DIR_APOSTILAS, cfg["file"])

try:
    reader = PdfReader(fpath)
    toc = proc.extract_toc(reader)
    print(f"Aula 05: {len(reader.pages)} pgs, {len(toc)} secoes")
    html_content = proc.build_aula_html("05", cfg, toc, reader)
    out_path = os.path.join("public", "preview", "aula-05-preview.html")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    with open("public/aula_05_debug.txt", "w", encoding="utf-8") as f:
        f.write(f"SUCESSO! {len(html_content)} bytes")
except Exception as e:
    with open("public/aula_05_debug.txt", "w", encoding="utf-8") as f:
        f.write(f"ERRO: {str(e)}\n{traceback.format_exc()}")
