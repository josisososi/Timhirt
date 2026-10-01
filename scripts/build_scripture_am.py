"""Parse the OCR'd Amharic Bible (see ocr_amharic.py) into data/scripture.am.json.

Source: the 1962 Amharic Bible (Haile Selassie era), electronic edition by
Interlitt, 66 books. It has NO Ethiopian-specific books (Enoch, Jubilees,
Meqabyan, ...), so those stay untranslated in Amharic.

The text is OCR output, so it is unverified: a few wrong characters are expected.
Output goes to /data (gitignored); the redistribution rights are not verified.

Usage: python scripts/build_scripture_am.py
"""
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OCR_DIR = os.path.join(ROOT, "source-texts", "amharic-ocr")
OUT = os.path.join(ROOT, "data", "scripture.am.json")

PAGE_OFFSET = 2  # printed page number + 2 = zero-based PDF page index

# (canon id, printed start page from the book's table of contents)
BOOKS = [
    ("genesis", 2), ("exodus", 50), ("leviticus", 89), ("numbers", 117),
    ("deuteronomy", 158), ("joshua", 193), ("judges", 215), ("ruth", 237),
    ("1-samuel", 240), ("2-samuel", 269), ("1-kings", 292), ("2-kings", 320),
    ("1-chronicles", 346), ("2-chronicles", 374), ("1-ezra", 404), ("nehemiah", 412),
    ("esther", 425), ("job", 431), ("psalms", 472), ("proverbs", 541),
    ("ecclesiastes", 566), ("song-of-songs", 573), ("isaiah", 576), ("jeremiah", 621),
    ("lamentations", 669), ("ezekiel", 673), ("daniel", 718), ("hosea", 731),
    ("joel", 738), ("amos", 740), ("obadiah", 745), ("jonah", 746), ("micah", 748),
    ("nahum", 752), ("habakkuk", 753), ("zephaniah", 755), ("haggai", 757),
    ("zechariah", 759), ("malachi", 766),
    ("matthew", 770), ("mark", 801), ("luke", 820), ("john", 853), ("acts", 879),
    ("romans", 910), ("1-corinthians", 923), ("2-corinthians", 936),
    ("galatians", 944), ("ephesians", 948), ("philippians", 953), ("colossians", 956),
    ("_defect_1peter_copy", 959), ("_defect_1john_copy", 962), ("2-thessalonians", 965), ("1-timothy", 966),
    ("2-timothy", 969), ("titus", 972), ("philemon", 973), ("hebrews", 974),
    ("james", 983), ("1-peter", 987), ("2-peter", 990), ("1-john", 992),
    ("2-john", 995), ("3-john", 996), ("jude", 996), ("revelation", 997),
]

CHAPTER = re.compile(r"^\s*ምዕራፍ\s*([0-9፩-፼]{1,3})\s*[።፤፥:.]*\s*$")
VERSE = re.compile(r"^\s*(\d{1,3})\s*[^\d\s]{0,2}\s*(.*)$")
DIGITS_ONLY = re.compile(r"^\s*\d{1,4}\s*$")


def load_pages():
    pages = []
    n = len([f for f in os.listdir(OCR_DIR) if f.startswith("page_") and f.endswith(".txt")])
    for i in range(n):
        with io.open(os.path.join(OCR_DIR, f"page_{i:04d}.txt"), encoding="utf-8") as f:
            lines = [ln.rstrip() for ln in f.read().split("\n")]
        while lines and not lines[-1].strip():
            lines.pop()
        if lines and DIGITS_ONLY.match(lines[-1]):
            lines.pop()  # printed page number in the footer
        pages.append([ln for ln in lines if ln.strip()])
    return pages


# "ምዕራፍ 12" (chapter) or "መዝሙር 12" (psalm); OCR may add "(1)", punctuation or glue the number on.
CHAPTER_LINE = re.compile(
    r"^\s*(?:ምዕራፍ|መዝሙር)(?:\s*(\d{0,6}))?(?:\s*\(\s*\d+\s*\))?[\s፠-፼.:;,#/|a-zA-Z]*$"
)
LEAD_DIGITS = re.compile(r"^\s*(\d{1,4})(.*)$")
RANGE = re.compile(r"^\s*(\d{1,3})\s*[-–—]\s*(\d{1,3})(.*)$")
SINGLE_MARK = re.compile(r"^\s*[^\s\d\w]?[ሀ-ቈ]፤\s*(.*)$")  # a verse number misread as one letter
JUNK_LEAD = re.compile(r"^[\s፠-፼\.,;:\-–—_=|«»<>()\[\]]+")


def near(digits, expected):
    """True if an OCR'd number is the expected one, allowing a duplicated digit/number."""
    e = str(expected)
    return digits == e or digits == e * 2 or (digits.startswith(e) and len(digits) == len(e) + 1)


def clean(text):
    return JUNK_LEAD.sub("", text).strip()


def parse_segment(lines):
    """Lines -> {chapter: {verse: text}}, anomalies.

    Trusts the sequence: chapters count up from 1, verses count up from 1,
    and OCR slips in the numbers (doubled digits, a misread verse number)
    are tolerated.
    """
    chapters, anomalies, titles = {}, [], {}
    ch, vs, buf = None, 0, []
    label = ""  # "5" or "3-4" for verses printed together

    def flush():
        if ch is not None and vs:
            chapters.setdefault(ch, {})[label] = " ".join(buf).strip()

    for pos, ln in enumerate(lines):
        m = CHAPTER_LINE.match(ln)
        if m:
            digits = m.group(1) or ""
            expected = 1 if ch is None else ch + 1
            if digits and not near(digits, expected):
                n = int(digits[:3])
                if ch is not None and ch < n <= ch + 3:
                    anomalies.append(f"chapter gap {ch}->{n}")
                    expected = n
                else:
                    anomalies.append(f"chapter number garbled after {ch}: {digits}")
            flush()
            ch, vs, buf = expected, 0, []
            continue
        if ch is None:
            r = RANGE.match(ln)
            v = LEAD_DIGITS.match(ln)
            if r and 1 < int(r.group(2)) <= 4:  # single-chapter book starting with a verse range (digit may be misread)
                ch, vs, buf, label = 1, int(r.group(2)), [clean(r.group(3))], f"1-{r.group(2)}"
            elif v and v.group(1) == "1":  # single-chapter book without a chapter marker
                ch, vs, buf, label = 1, 1, [clean(v.group(2))], "1"
            continue

        e = vs + 1
        r = RANGE.match(ln)
        if r and near(r.group(1), e) and int(r.group(1)) < int(r.group(2)) <= e + 4:
            # verses printed together, e.g. "3-4 text": keep as one combined verse
            flush()
            vs, label, buf = int(r.group(2)), f"{e}-{r.group(2)}", [clean(r.group(3))]
            continue
        v = LEAD_DIGITS.match(ln)
        if v and len(re.findall(r"[ሀ-ቈ]", v.group(2))) >= 2:
            digits, rest = v.group(1), v.group(2)
            n = int(digits)
            if near(digits, e):
                pass
            elif e < n <= e + 3:
                anomalies.append(f"verse gap {ch}:{vs}->{n}")
                e = n
            else:
                anomalies.append(f"verse {ch}:{e} number misread as {digits}")
            flush()
            vs, label, buf = e, str(e), [clean(rest)]
            continue
        if not v:
            s = SINGLE_MARK.match(ln)
            if s:  # number misread as a letter: it is the expected verse
                flush()
                vs, label, buf = e, str(e), [clean(s.group(1))]
                anomalies.append(f"verse {ch}:{e} number misread")
                continue
            if vs == 0:
                ahead = lines[pos + 1 : pos + 4]
                if any(re.match(r"^\s*1(?!\d)", x) for x in ahead):
                    titles.setdefault(ch, []).append(clean(ln))  # e.g. a Psalm title before verse 1
                    continue
                vs, label, buf = 1, "1", [clean(ln)]  # first line after a chapter marker is verse 1
                anomalies.append(f"verse {ch}:1 number missing")
                continue
        if vs:
            buf.append(ln.strip())
    flush()
    return chapters, anomalies, titles


# A book heading is "<title> (<garbled Latin name>)", optionally led by an ordinal like "2ኛ".
HEADING = re.compile(r"^\s*(?:\d{1,2}ኛ\s*)?[^\d()]{3,60}\s*\([^)]{1,40}\)?\s*\.?\s*$")


def find_book_starts(pages):
    """Return one (page, line) heading position per book, matched to the table of contents."""
    hits = [
        (pi, li)
        for pi in range(PAGE_OFFSET + 2, len(pages))
        for li, ln in enumerate(pages[pi])
        if HEADING.match(ln)
    ]
    starts, cursor = [], 0
    for bid, printed in BOOKS:
        expect = printed + PAGE_OFFSET
        # first unused heading on a page within a few pages of the table-of-contents page
        pick = next((h for h in hits[cursor:] if expect - 1 <= h[0] <= expect + 1), None)
        if pick is not None:
            cursor = hits.index(pick) + 1
        else:
            # heading garbled by OCR: fall back to a chapter-1 marker near the expected page
            prev = starts[-1] if starts else (0, -1)
            for pi in range(max(expect - 1, prev[0]), min(expect + 4, len(pages))):
                for li, ln in enumerate(pages[pi]):
                    m = CHAPTER_LINE.match(ln)
                    if (pi, li - 1) > prev and m and (m.group(1) or "1") == "1":
                        pick = (pi, li - 1)
                        break
                if pick:
                    break
            if pick is None:
                raise SystemExit(f"no heading or chapter 1 found for {bid} near page {expect}")
            print(f"  note: no heading for {bid}; started at its chapter-1 marker")
        starts.append(pick)
    return starts


def book_lines(pages, starts, idx):
    """Lines from this book's heading up to (not including) the next book's heading."""
    sp, sl = starts[idx]
    ep, el = starts[idx + 1] if idx + 1 < len(starts) else (len(pages) - 1, len(pages[-1]))
    lines = []
    for pi in range(sp, ep + 1):
        pl = pages[pi]
        lo = sl + 1 if pi == sp else 0
        hi = el if pi == ep else len(pl)
        lines.extend(pl[lo:hi])
    return lines


def main():
    pages = load_pages()
    print(f"{len(pages)} OCR pages loaded")
    starts = find_book_starts(pages)
    out, report = [], []
    for idx, (bid, _start) in enumerate(BOOKS):
        lines = book_lines(pages, starts, idx)
        if bid == "1-john":
            lines = lines  # 2 and 3 John have their own headings, so no tail splitting is needed
        chapters, anomalies, titles = parse_segment(lines)
        if bid.startswith("_"):
            print(f"  note: skipped defective block {bid} (the PDF has the wrong text here)")
            continue
        if bid == "psalms":
            for c, t in titles.items():  # psalm titles are stored as verse 0, as in the English data
                if c in chapters:
                    chapters[c]["0"] = " ".join(t)
        verses = sum(len(v) for v in chapters.values())
        report.append((bid, len(chapters), verses, len(anomalies)))
        out.append((bid, chapters))

    # Proverbs: Ethiopic canon splits it into Messale (1-24) and Tagsas (25-31)
    final = {}
    for bid, chapters in out:
        if bid == "proverbs":
            final["messale"] = {c: v for c, v in chapters.items() if c <= 24}
            final["tagsas"] = {c: v for c, v in chapters.items() if c >= 25}
        else:
            final[bid] = chapters

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    data = [
        {
            "id": bid,
            "chapters": {
                str(c): {k: t for k, t in sorted(vs.items(), key=lambda kv: int(kv[0].split("-")[0]))}
                for c, vs in sorted(ch.items())
            },
        }
        for bid, ch in final.items()
    ]
    with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"wrote {OUT}")
    print(f"{'book':18}{'chap':>6}{'verses':>8}{'gaps':>6}")
    for r in report:
        print(f"{r[0]:18}{r[1]:>6}{r[2]:>8}{r[3]:>6}")


if __name__ == "__main__":
    main()
