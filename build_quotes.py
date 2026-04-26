#!/usr/bin/env python3
"""Bygger site/quotes.json fra kildefilerne.

Kører lokalt før hver deploy. Læser:
- keiding_samlet.txt (autentiske citater fra forelæsninger)
- keiding_ai_citater.txt (AI-genererede i hans stil)

Skriver site/quotes.json som array af
{"id": str, "text": str, "source": "original"|"ai", "section": str|null}.

ID er en 6-tegns SHA-1-hash af teksten — stabil på tværs af genbygninger
så længe teksten er uændret. Bruges til permalink-URLs på siden.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent

ORIGINAL_HEADER_PATTERNS = [
    re.compile(r"^Part [IVX]+:?$", re.IGNORECASE),
    re.compile(r"^Fra .{1,60}:$"),
]

QUOTE_CHARS = "“”„‟\"'"


def quote_id(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:6]


def split_paragraphs(text: str) -> list[str]:
    return re.split(r"\n\s*\n", text)


def normalize(p: str) -> str:
    p = re.sub(r"\s+", " ", p).strip()
    if len(p) >= 2 and p[0] in QUOTE_CHARS and p[-1] in QUOTE_CHARS:
        p = p[1:-1].strip()
    return p


def strip_leading_headers(raw: str) -> str:
    lines = raw.split("\n")
    while lines:
        first = lines[0].strip()
        if not first:
            lines = lines[1:]
            continue
        if any(pat.match(first) for pat in ORIGINAL_HEADER_PATTERNS):
            lines = lines[1:]
            continue
        break
    return "\n".join(lines)


def parse_original(path: Path) -> list[dict]:
    quotes: list[dict] = []
    text = path.read_text(encoding="utf-8")

    for raw in split_paragraphs(text):
        raw = strip_leading_headers(raw)
        p = normalize(raw)
        if not p:
            continue
        if any(pat.match(p) for pat in ORIGINAL_HEADER_PATTERNS):
            continue
        if len(p) < 25:
            continue
        quotes.append({"text": p, "source": "original", "section": None})

    return quotes


def parse_ai(path: Path) -> list[dict]:
    """Parser AI-filen og knytter hvert citat til den sektion det står under.

    Filformat:
        ## fil-kommentar
        ================================================================================
        SECTION NAME
        ================================================================================

        Citat 1.

        Citat 2.

        ================================================================================
        NEXT SECTION
        ...

    Sektionsnavnet "SLUT" markerer filens ende og giver ikke section-tag.
    """
    text = path.read_text(encoding="utf-8")

    quotes: list[dict] = []
    current_section: str | None = None
    in_section_header = False
    pending_section_name = ""
    paragraph_lines: list[str] = []
    paragraph_section: str | None = None

    def flush_paragraph() -> None:
        nonlocal paragraph_lines, paragraph_section
        if not paragraph_lines:
            return
        p = normalize("\n".join(paragraph_lines))
        if p and len(p) >= 30 and p.endswith((".", "!", "?")):
            quotes.append(
                {"text": p, "source": "ai", "section": paragraph_section}
            )
        paragraph_lines = []
        paragraph_section = None

    for line in text.split("\n"):
        stripped = line.strip()

        if stripped.startswith("#"):
            continue

        if stripped.startswith("="):
            if in_section_header:
                # Lukker section-header
                in_section_header = False
                name = pending_section_name.strip()
                if name and name.upper() != "SLUT":
                    current_section = name.lower()
                else:
                    current_section = None
                pending_section_name = ""
            else:
                # Åbner section-header
                flush_paragraph()
                in_section_header = True
            continue

        if in_section_header:
            if stripped:
                pending_section_name = (
                    pending_section_name + " " + stripped
                ).strip()
            continue

        if stripped:
            if not paragraph_lines:
                paragraph_section = current_section
            paragraph_lines.append(line)
        else:
            flush_paragraph()

    flush_paragraph()
    return quotes


def main() -> None:
    quotes: list[dict] = []
    quotes += parse_original(REPO / "keiding_samlet.txt")
    quotes += parse_ai(REPO / "keiding_ai_citater.txt")

    # Dedupe på exakt tekst
    seen: set[str] = set()
    deduped: list[dict] = []
    for q in quotes:
        if q["text"] in seen:
            continue
        seen.add(q["text"])
        deduped.append(q)

    # Tilføj stabile ID'er (6 tegn SHA-1)
    used_ids: set[str] = set()
    for q in deduped:
        qid = quote_id(q["text"])
        # Mod kollisioner: udvid hashen indtil unik (extremt sjældent ved 6 tegn)
        attempt = qid
        i = 6
        while attempt in used_ids:
            i += 1
            attempt = hashlib.sha1(q["text"].encode("utf-8")).hexdigest()[:i]
        used_ids.add(attempt)
        q["id"] = attempt

    # Reorder felter til pænere JSON
    output = [
        {"id": q["id"], "text": q["text"], "source": q["source"], "section": q["section"]}
        for q in deduped
    ]

    out_dir = REPO / "site"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "quotes.json"
    out_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    n_orig = sum(1 for q in output if q["source"] == "original")
    n_ai = sum(1 for q in output if q["source"] == "ai")
    sections = sorted({q["section"] for q in output if q["section"]})
    print(f"Skrev {len(output)} citater til {out_path}")
    print(f"  autentiske:    {n_orig}")
    print(f"  ai-genereret:  {n_ai}")
    print(f"  ai-sektioner:  {len(sections)}")
    for s in sections:
        n = sum(1 for q in output if q["section"] == s)
        print(f"    {n:>3}  {s}")


if __name__ == "__main__":
    main()
