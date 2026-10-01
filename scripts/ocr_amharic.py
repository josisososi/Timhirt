"""OCR the scanned-look Amharic Bible PDF page by page (resumable, parallel).

The PDF's embedded text layer is garbled by a font-encoding problem, so the
pages are rendered to images and read with Tesseract's Amharic model.

Usage:
    python scripts/ocr_amharic.py [workers]

Needs: pip install pymupdf; Tesseract installed; source-texts/tessdata/amh.traineddata
Output: source-texts/amharic-ocr/page_0000.txt ... (gitignored)
"""
import os
import subprocess
import sys
import tempfile
from multiprocessing import Pool

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, "source-texts", "amharic-eotc-bible.pdf")
OUT = os.path.join(ROOT, "source-texts", "amharic-ocr")
TESSDATA = os.path.join(ROOT, "source-texts", "tessdata")
TESSERACT = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def ocr_page(i):
    dest = os.path.join(OUT, f"page_{i:04d}.txt")
    if os.path.exists(dest):
        return i
    with tempfile.TemporaryDirectory() as tmp:
        png = os.path.join(tmp, "p.png")
        with pymupdf.open(PDF) as doc:
            doc[i].get_pixmap(dpi=250).save(png)
        base = os.path.join(tmp, "out")
        subprocess.run(
            [TESSERACT, png, base, "-l", "amh", "--psm", "3"],
            env={**os.environ, "TESSDATA_PREFIX": TESSDATA},
            check=True,
            capture_output=True,
        )
        with open(base + ".txt", "rb") as f:
            data = f.read()
    with open(dest + ".tmp", "wb") as f:
        f.write(data)
    os.replace(dest + ".tmp", dest)  # only complete pages count as done
    return i


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else max(1, (os.cpu_count() or 2) - 1)
    with pymupdf.open(PDF) as doc:
        n = len(doc)
    done = 0
    with Pool(workers) as pool:
        for _ in pool.imap_unordered(ocr_page, range(n)):
            done += 1
            if done % 25 == 0:
                print(f"{done}/{n}", flush=True)
    print("finished", flush=True)
