#!/usr/bin/env python3
"""Bygger site/quotes.json fra kildefilerne.

Kører lokalt før hver deploy. Læser:
- keiding_samlet.txt (autentiske citater fra forelæsninger)
- keiding_ai_citater.txt (AI-genererede i hans stil)

Skriver site/quotes.json som array af {"text": str, "source": "original"|"ai"}.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent

# Headers/præfikser i samlet.txt der ikke er citater
ORIGINAL_HEADER_PATTERNS = [
    re.compile(r"^Part [IVX]+:?$", re.IGNORECASE),
    re.compile(r"^Fra .{1,60}:$"),
]


def split_paragraphs(text: str) -> list[str]:
    return re.split(r"\n\s*\n", text)


QUOTE_CHARS = "“”„‟\"'"


def normalize(p: str) -> str:
    p = re.sub(r"\s+", " ", p).strip()
    # Fjern KUN ydre gåseøjne hvis BÅDE start og slut er gåseøjne
    # (ellers ødelægges citater med citeret tale i slutningen)
    if len(p) >= 2 and p[0] in QUOTE_CHARS and p[-1] in QUOTE_CHARS:
        p = p[1:-1].strip()
    return p


def strip_leading_headers(raw: str) -> str:
    """Fjern "Part II:" / "Fra ...:" header-linjer i toppen af et paragraph."""
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
        quotes.append({"text": p, "source": "original"})

    return quotes


def parse_ai(path: Path) -> list[dict]:
    quotes: list[dict] = []
    text = path.read_text(encoding="utf-8")

    # Fjern fil-kommentarer (## ...) og separator-linjer (=====)
    kept_lines = []
    for line in text.split("\n"):
        stripped = line.lstrip()
        if stripped.startswith("#"):
            continue
        if stripped.startswith("="):
            continue
        kept_lines.append(line)
    cleaned = "\n".join(kept_lines)

    for raw in split_paragraphs(cleaned):
        p = normalize(raw)
        if not p:
            continue

        # Skip korte sektionstitler hvor det meste er stort bogstav
        if len(p) < 80:
            letters = [c for c in p if c.isalpha()]
            if letters:
                upper_ratio = sum(1 for c in letters if c.isupper()) / len(letters)
                if upper_ratio > 0.7:
                    continue

        # Citater slutter typisk på sætningstegn
        if not p.endswith((".", "!", "?")):
            continue
        if len(p) < 30:
            continue

        quotes.append({"text": p, "source": "ai"})

    return quotes


def main() -> None:
    quotes: list[dict] = []
    quotes += parse_original(REPO / "keiding_samlet.txt")
    quotes += parse_ai(REPO / "keiding_ai_citater.txt")

    # Dedupe på exakt tekst (samlet.txt har et par dubletter på tværs af parts)
    seen: set[str] = set()
    deduped: list[dict] = []
    for q in quotes:
        if q["text"] in seen:
            continue
        seen.add(q["text"])
        deduped.append(q)

    out_dir = REPO / "site"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "quotes.json"
    out_path.write_text(
        json.dumps(deduped, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    n_orig = sum(1 for q in deduped if q["source"] == "original")
    n_ai = sum(1 for q in deduped if q["source"] == "ai")
    print(f"Skrev {len(deduped)} citater til {out_path}")
    print(f"  autentiske:    {n_orig}")
    print(f"  ai-genereret:  {n_ai}")


if __name__ == "__main__":
    main()
