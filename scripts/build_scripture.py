"""Build the 81-book canon list and (optionally) parse scripture text from a PDF.

Usage:
    python scripts/build_scripture.py [path/to/bible.pdf]

Always writes src/data/canon.json (structure only, safe to commit).
With a PDF, also writes data/scripture.en.json. That folder is gitignored:
the text comes from a source whose redistribution rights are NOT verified,
so it must never be committed or published.

Requires: pip install pypdf
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------------------
# The 81-book "narrower canon" of the Ethiopian Orthodox Tewahedo Church
# (54 OT + 27 NT), in canonical order. Names follow the Ethiopic tradition
# with the common English name. `pdf` is the heading key used to find the
# book in the source PDF; `None` means the text is not in that PDF.
# ---------------------------------------------------------------------------
CANON = [
    # (id, english name, ge'ez/alt name, testament, pdf key)
    ("genesis", "Genesis", None, "OT", "genesis"),
    ("exodus", "Exodus", None, "OT", "exodus"),
    ("leviticus", "Leviticus", None, "OT", "leviticus"),
    ("numbers", "Numbers", None, "OT", "numbers"),
    ("deuteronomy", "Deuteronomy", None, "OT", "deuteronomy"),
    ("joshua", "Joshua", None, "OT", "joshua"),
    ("judges", "Judges", None, "OT", "judges"),
    ("ruth", "Ruth", None, "OT", "ruth"),
    ("1-samuel", "1 Samuel", None, "OT", "1samuel"),
    ("2-samuel", "2 Samuel", None, "OT", "2samuel"),
    ("1-kings", "1 Kings", None, "OT", "1kings"),
    ("2-kings", "2 Kings", None, "OT", "2kings"),
    ("1-chronicles", "1 Chronicles", None, "OT", "1chronicles"),
    ("2-chronicles", "2 Chronicles", None, "OT", "2chronicles"),
    ("jubilees", "Jubilees", "Kufale", "OT", "jubilees"),
    ("enoch", "Enoch", "Henok", "OT", "enoch"),
    ("1-ezra", "1 Ezra", "1 Izra", "OT", "ezra"),
    ("nehemiah", "Nehemiah", None, "OT", "nehemiah"),
    ("3-ezra", "Ezra (Greek Esdras)", "3 Izra", "OT", "esdras1"),
    ("4-ezra", "Ezra Sutuel", "Izra Sutuel", "OT", "esdras2"),
    ("tobit", "Tobit", "Tobit", "OT", "tobit"),
    ("judith", "Judith", "Judith", "OT", "judith"),
    ("esther", "Esther", None, "OT", "esther"),
    ("1-meqabyan", "1 Meqabyan", "1 Meqabyan", "OT", "meq1"),
    ("2-meqabyan", "2 Meqabyan", "2 Meqabyan", "OT", "meq2"),
    ("3-meqabyan", "3 Meqabyan", "3 Meqabyan", "OT", "meq3"),
    ("job", "Job", None, "OT", "job"),
    ("psalms", "Psalms", "Mezmur", "OT", "psalms"),
    ("messale", "Proverbs (Messale)", "Messale", "OT", "proverbs:1-24"),
    ("tagsas", "Proverbs (Tagsas)", "Tagsas", "OT", "proverbs:25-31"),
    ("wisdom", "Wisdom of Solomon", "Wisdom of Solomon", "OT", "wisdom"),
    ("ecclesiastes", "Ecclesiastes", None, "OT", "eccl"),
    ("song-of-songs", "Song of Songs", None, "OT", "song"),
    ("sirach", "Sirach", "Wisdom of Sirach", "OT", "sirach"),
    ("isaiah", "Isaiah", None, "OT", "isaiah"),
    ("jeremiah", "Jeremiah", None, "OT", "jeremiah"),
    ("baruch", "Baruch", None, "OT", "baruch"),
    ("lamentations", "Lamentations", None, "OT", "lam"),
    ("letter-of-jeremiah", "Letter of Jeremiah", "Terefermias", "OT", "letterjer"),
    ("4-baruch", "4 Baruch", "Teref Baruch", "OT", "baruch4"),
    ("ezekiel", "Ezekiel", None, "OT", "ezekiel"),
    ("daniel", "Daniel", None, "OT", "daniel"),
    ("hosea", "Hosea", None, "OT", "hosea"),
    ("amos", "Amos", None, "OT", "amos"),
    ("micah", "Micah", None, "OT", "micah"),
    ("joel", "Joel", None, "OT", "joel"),
    ("obadiah", "Obadiah", None, "OT", "obadiah"),
    ("jonah", "Jonah", None, "OT", "jonah"),
    ("nahum", "Nahum", None, "OT", "nahum"),
    ("habakkuk", "Habakkuk", None, "OT", "habakkuk"),
    ("zephaniah", "Zephaniah", None, "OT", "zephaniah"),
    ("haggai", "Haggai", None, "OT", "haggai"),
    ("zechariah", "Zechariah", None, "OT", "zechariah"),
    ("malachi", "Malachi", None, "OT", "malachi"),
    ("matthew", "Matthew", None, "NT", "matthew"),
    ("mark", "Mark", None, "NT", "mark"),
    ("luke", "Luke", None, "NT", "luke"),
    ("john", "John", None, "NT", "john"),
    ("acts", "Acts", None, "NT", "acts"),
    ("romans", "Romans", None, "NT", "romans"),
    ("1-corinthians", "1 Corinthians", None, "NT", "1cor"),
    ("2-corinthians", "2 Corinthians", None, "NT", "2cor"),
    ("galatians", "Galatians", None, "NT", "galatians"),
    ("ephesians", "Ephesians", None, "NT", "ephesians"),
    ("philippians", "Philippians", None, "NT", "philippians"),
    ("colossians", "Colossians", None, "NT", "colossians"),
    ("1-thessalonians", "1 Thessalonians", None, "NT", "1thess"),
    ("2-thessalonians", "2 Thessalonians", None, "NT", "2thess"),
    ("1-timothy", "1 Timothy", None, "NT", "1tim"),
    ("2-timothy", "2 Timothy", None, "NT", "2tim"),
    ("titus", "Titus", None, "NT", "titus"),
    ("philemon", "Philemon", None, "NT", "philemon"),
    ("hebrews", "Hebrews", None, "NT", "hebrews"),
    ("james", "James", None, "NT", "james"),
    ("1-peter", "1 Peter", None, "NT", "1pet"),
    ("2-peter", "2 Peter", None, "NT", "2pet"),
    ("1-john", "1 John", None, "NT", "1john"),
    ("2-john", "2 John", None, "NT", "2john"),
    ("3-john", "3 John", None, "NT", "3john"),
    ("jude", "Jude", None, "NT", "jude"),
    ("revelation", "Revelation", None, "NT", "revelation"),
]
assert len(CANON) == 81, len(CANON)

# Headings in the order they appear in the source PDF (used to cut it into
# books). Items that are not in the 81-book canon still act as boundaries.
PDF_HEADINGS = [
    ("genesis", "The First Book of Moses, Genesis"),
    ("exodus", "The Second Book of Moses, Exodus"),
    ("leviticus", "The Third Book of Moses, Leviticus"),
    ("numbers", "The Fourth Book of Moses, Numbers"),
    ("deuteronomy", "The Fifth Book of Moses, Deuteronomy"),
    ("joshua", "The Book of Joshua"),
    ("judges", "The Book of Judges"),
    ("ruth", "The Book of Ruth"),
    ("1samuel", "The First Book of Samuel"),
    ("2samuel", "The Second Book of Samuel"),
    ("1kings", "The First Book of Kings"),
    ("2kings", "The Second Book of Kings"),
    ("1chronicles", "The First Book of Chronicles"),
    ("2chronicles", "The Second Book of Chronicles"),
    ("manasses", "The Prayer of Manasses"),
    ("jubilees", "The Book of Jubilees, or The Little Genesis"),
    ("enoch", "The Book of Enoch"),
    ("enoch2", "The Second Book of Enoch, or Slavonic Enoch, or The Book of the Secrets of Enoch"),
    ("ezra", "The Book of Ezra"),
    ("nehemiah", "The Book of Nehemiah"),
    ("esdras1", "The First Book of Esdras, or Ezra Kali"),
    ("esdras2", "The Second Book of Esdras, or Ezra Sutu'el"),
    ("tobit", "The Book of Tobit"),
    ("judith", "The Book of Judith"),
    ("esther", "The Book of Esther"),
    ("esther_add", "Additions to Esther, translated from the Greek Septuagint"),
    ("meq1", "The Book of Meqabyan I"),
    ("meq2", "The Book of Meqabyan II"),
    ("meq3", "The Book of Meqabyan III"),
    ("job", "The Book of Job"),
    ("psalms", "The Psalms"),
    ("ps151", "Psalm 151"),
    ("proverbs", "The Proverbs"),
    ("wisdom", "The Wisdom of Solomon"),
    ("eccl", "Ecclesiastes or, The Preacher"),
    ("song", "The Song of Songs, or Song of Solomon"),
    ("sirach", "The Wisdom of Jesus the Son of Sirach, or Ecclesiasticus"),
    ("isaiah", "The Book of the Prophet Isaiah"),
    ("jeremiah", "The Book of Jeremiah"),
    ("lam", "The Lamentations of Jeremiah"),
    ("baruch", "The Book of Baruch"),
    ("letterjer", "The Letter of Jeremiah"),
    ("baruch4", "4 Baruch, or Paralipomena of Jeremiah"),
    ("ezekiel", "The Book of Ezekiel"),
    ("daniel", "The Book of Daniel"),
    ("azariah", "The Song of the Three Holy Children, or The Prayer of Azariah"),
    ("susanna", "The History of Susanna"),
    ("bel", "Bel and the Dragon"),
    ("hosea", "The Book of Hosea"),
    ("joel", "The Book of Joel"),
    ("amos", "The Book of Amos"),
    ("obadiah", "The Book of Obadiah"),
    ("jonah", "The Book of Jonah"),
    ("micah", "The Book of Micah"),
    ("nahum", "The Book of Nahum"),
    ("habakkuk", "The Book of Habakkuk"),
    ("zephaniah", "The Book of Zephaniah"),
    ("haggai", "The Book of Haggai"),
    ("zechariah", "The Book of Zechariah"),
    ("malachi", "The Book of Malachi"),
    ("matthew", "The Good News According to Matthew"),
    ("mark", "The Good News According to Mark"),
    ("luke", "The Good News According to Luke"),
    ("john", "The Good News According to John"),
    ("acts", "The Acts of the Apostles"),
    ("romans", "Paul’s Letter to the Romans"),
    ("1cor", "Paul’s First Letter to the Corinthians"),
    ("2cor", "Paul’s Second Letter to the Corinthians"),
    ("galatians", "Paul’s Letter to the Galatians"),
    ("ephesians", "Paul’s Letter to the Ephesians"),
    ("philippians", "Paul’s Letter to the Philippians"),
    ("colossians", "Paul’s Letter to the Colossians"),
    ("1thess", "Paul’s First Letter to the Thessalonians"),
    ("2thess", "Paul’s Second Letter to the Thessalonians"),
    ("1tim", "Paul’s First Letter to Timothy"),
    ("2tim", "Paul’s Second Letter to Timothy"),
    ("titus", "Paul’s Letter to Titus"),
    ("philemon", "Paul’s Letter to Philemon"),
    ("hebrews", "The Letter to the Hebrews"),
    ("james", "The Letter from James"),
    ("1pet", "Peter’s First Letter"),
    ("2pet", "Peter’s Second Letter"),
    ("1john", "John’s First Letter"),
    ("2john", "John’s Second Letter"),
    ("3john", "John’s Third Letter"),
    ("jude", "The Letter from Jude"),
    ("revelation", "Revelation"),
    ("clement1", "The First Epistle of Clement to the Corinthians"),
    ("glossary", "Glossary"),
]

# Standard chapter counts for books shared with the 66-book Bible, used only
# to sanity-check the parser.
EXPECTED_CHAPTERS = {
    "genesis": 50, "exodus": 40, "leviticus": 27, "numbers": 36, "deuteronomy": 34,
    "joshua": 24, "judges": 21, "ruth": 4, "1-samuel": 31, "2-samuel": 24,
    "1-kings": 22, "2-kings": 25, "1-chronicles": 29, "2-chronicles": 36,
    "1-ezra": 10, "nehemiah": 13, "esther": 10, "job": 42, "psalms": 150,
    "ecclesiastes": 12, "song-of-songs": 8, "isaiah": 66, "jeremiah": 52,
    "lamentations": 5, "ezekiel": 48, "daniel": 12, "hosea": 14, "joel": 3,
    "amos": 9, "obadiah": 1, "jonah": 4, "micah": 7, "nahum": 3, "habakkuk": 3,
    "zephaniah": 3, "haggai": 2, "zechariah": 14, "malachi": 4,
    "matthew": 28, "mark": 16, "luke": 24, "john": 21, "acts": 28, "romans": 16,
    "1-corinthians": 16, "2-corinthians": 13, "galatians": 6, "ephesians": 6,
    "philippians": 4, "colossians": 4, "1-thessalonians": 5, "2-thessalonians": 3,
    "1-timothy": 6, "2-timothy": 4, "titus": 3, "philemon": 1, "hebrews": 13,
    "james": 5, "1-peter": 5, "2-peter": 3, "1-john": 5, "2-john": 1, "3-john": 1,
    "jude": 1, "revelation": 22,
}


def write_canon():
    books = [
        {
            "id": bid,
            "canon_order": i + 1,
            "testament": testament,
            "name_en": name,
            "name_alt": alt,
            "name_am": None,  # TODO: add verified Amharic names
            "numbering_system": "eotc",
        }
        for i, (bid, name, alt, testament, _pdf) in enumerate(CANON)
    ]
    path = os.path.join(ROOT, "src", "data", "canon.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with io.open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(books, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"wrote {path} ({len(books)} books)")


def heading_regex(text):
    def word(w):
        # allow straight or curly apostrophes interchangeably
        return "".join("['’]" if c in "'’" else re.escape(c) for c in w)

    body = r"\s+".join(word(w) for w in text.split())
    # The heading must be a whole line and must not be followed by a lowercase or
    # punctuation continuation (guards against the same words inside running text).
    return re.compile(r"(?m)^[ \t]*" + body + r"[ \t]*$(?!\n[ \t]*[,.;a-z])")


def load_pdf_text(pdf_path):
    from pypdf import PdfReader

    reader = PdfReader(pdf_path)
    parts = []
    for i, page in enumerate(reader.pages):
        parts.append(f"\n<<<PAGE {i + 1}>>>\n" + (page.extract_text() or ""))
    return "".join(parts)


def cut_books(text):
    """Return {pdf_key: raw text} using headings found in order."""
    start = text.index("<<<PAGE 9>>>")  # skip front matter and table of contents
    pos = start
    found = []
    for key, heading in PDF_HEADINGS:
        m = heading_regex(heading).search(text, pos)
        if not m:
            print(f"  ! heading not found: {key!r} ({heading})")
            continue
        found.append((key, m.start(), m.end()))
        pos = m.end()
    segments = {}
    for i, (key, _s, e) in enumerate(found):
        end = found[i + 1][1] if i + 1 < len(found) else len(text)
        segments[key] = text[e:end]
    return segments


NUM = re.compile(r"^\s*(\d{1,3})\s*$")
SECTION = re.compile(r"^\s*Book\s+\d+\s*$")


def parse_chapters(raw):
    """Parse 'chapter / verse / text' layout into {chapter: {verse: text}}.

    A bare number line is a chapter marker when it is followed by another bare
    number (the '1' of verse 1); otherwise it is the next verse number.
    A chapter marker may also be followed by one short line (a Psalm title or a
    Song of Songs speaker label) before verse 1; that line is returned as the
    chapter's title. Returns (chapters, anomalies, titles).
    """
    raw = re.sub(r"<<<PAGE \d+>>>", "", raw)
    lines = [ln.strip() for ln in raw.split("\n")]
    lines = [ln for ln in lines if ln]
    chapters, anomalies, titles = {}, [], {}
    ch, vs, buf = None, 0, []

    def flush():
        if ch is not None and vs:
            chapters.setdefault(ch, {})[vs] = " ".join(buf).strip()

    def next_line(i):
        return lines[i + 1] if i + 1 < len(lines) else ""

    i = 0
    while i < len(lines):
        ln = lines[i]
        m = NUM.match(ln)
        if m:
            n = int(m.group(1))
            nxt = next_line(i)
            nxt_is_num = bool(NUM.match(nxt)) and int(NUM.match(nxt).group(1)) == 1
            nxt_is_section = bool(SECTION.match(nxt))
            # chapter, then a short title/label line, then verse 1
            title_len = 0  # number of title lines between the chapter number and verse 1
            if ch is not None and n == ch + 1:
                for k in range(1, 7):
                    cand = lines[i + k] if i + k < len(lines) else ""
                    if NUM.match(cand) or SECTION.match(cand) or len(cand) > 200 or not cand:
                        break
                    after = lines[i + k + 1] if i + k + 1 < len(lines) else ""
                    if NUM.match(after) and int(NUM.match(after).group(1)) == 1:
                        title_len = k
                        break
            nxt_is_title = title_len > 0
            chapter_ok = ch is None and n == 1 or ch is not None and ch < n <= ch + 3
            if (nxt_is_num or nxt_is_section) and chapter_ok:
                if ch is not None and n != ch + 1:
                    anomalies.append(f"chapter gap {ch}->{n}")
                flush()
                ch, vs, buf = n, 0, []
                i += 2  # consume the chapter number and the following '1' / 'Book k' line
                if nxt_is_num:
                    vs = 1  # that '1' was verse 1; for a 'Book k' line verse 1 follows
                continue
            if nxt_is_title:
                flush()
                ch, vs, buf = n, 0, []
                titles[n] = " ".join(lines[i + 1 : i + 1 + title_len])
                i += 1 + title_len  # consume the chapter number and its title; verse 1 follows
                continue
            if ch is None and n == 1:
                ch, vs, buf = 1, 1, []  # single-chapter book without chapter marker
                i += 1
                continue
            if ch is not None and vs + 1 <= n <= vs + 4:
                if n != vs + 1:
                    anomalies.append(f"gap {ch}:{vs}->{n}")
                flush()
                vs, buf = n, []
                i += 1
                continue
        if ch is not None and vs:
            buf.append(ln)
        i += 1
    flush()
    return chapters, anomalies, titles


def build_text(pdf_path):
    print("reading PDF ...")
    text = load_pdf_text(pdf_path)
    segments = cut_books(text)
    parsed = {}
    for key, raw in segments.items():
        if key == "song":  # drop 'Beloved' / 'Lover' / 'Friends' speaker labels
            raw = re.sub(r"(?m)^(Beloved|Lover|Lovers|Friends|Bride|Bridegroom)[ \t]*\n", "", raw)
        parsed[key] = parse_chapters(raw)

    out, report = [], []
    for i, (bid, name, _alt, _t, pdf_key) in enumerate(CANON):
        chapter_filter = None
        if ":" in pdf_key:
            pdf_key, rng = pdf_key.split(":")
            lo, hi = (int(x) for x in rng.split("-"))
            chapter_filter = (lo, hi)
        chapters, anomalies, titles = parsed.get(pdf_key, ({}, ["missing"], {}))
        chapters = {c: dict(v) for c, v in chapters.items()}
        if bid == "psalms":
            for c, title in titles.items():  # psalm titles are stored as verse 0
                if c in chapters:
                    chapters[c][0] = title
            if "ps151" in parsed:
                ps151 = parsed["ps151"][0]
                if 1 in ps151:
                    chapters[151] = ps151[1]
        if chapter_filter:
            lo, hi = chapter_filter
            chapters = {c: v for c, v in chapters.items() if lo <= c <= hi}
        verses = sum(len(v) for v in chapters.values())
        expected = EXPECTED_CHAPTERS.get(bid)
        got = len(chapters)
        flag = ""
        if not chapters:
            flag = "NO TEXT"
        elif expected and bid != "psalms" and got != expected:
            flag = f"chapters {got} != {expected}"
        elif bid == "psalms" and got not in (150, 151):
            flag = f"chapters {got}"
        report.append((bid, got, verses, len(anomalies), flag))
        out.append(
            {
                "id": bid,
                "chapters": {
                    str(c): {str(v): t for v, t in sorted(vs.items())}
                    for c, vs in sorted(chapters.items())
                },
            }
        )

    data_dir = os.path.join(ROOT, "data")
    os.makedirs(data_dir, exist_ok=True)
    path = os.path.join(data_dir, "scripture.en.json")
    with io.open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"wrote {path}")

    print(f"{'book':22}{'chap':>6}{'verses':>8}{'gaps':>6}  flag")
    for bid, got, verses, gaps, flag in report:
        print(f"{bid:22}{got:>6}{verses:>8}{gaps:>6}  {flag}")
    ok = sum(1 for r in report if not r[4])
    print(f"\n{ok}/81 books parsed with no flags; total verses {sum(r[2] for r in report)}")


if __name__ == "__main__":
    write_canon()
    if len(sys.argv) > 1:
        build_text(sys.argv[1])
