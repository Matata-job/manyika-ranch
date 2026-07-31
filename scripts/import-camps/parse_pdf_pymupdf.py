"""
Extract animal rows from Manyika camp PDFs via PyMuPDF word positions.
Clusters words into table rows by Y, then assigns columns by X.
Usage: python3 parse_pdf_pymupdf.py /path/to/camp.pdf
Prints JSON: { animals, summaryNotes, method, meta }
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".python-libs"))

import fitz  # noqa: E402

# Column x midpoints (approx, A4 form)
COL = {
    "sn": (20, 55),
    "hereni": (55, 100),
    "sex": (100, 145),
    "age": (145, 210),
    "aina": (210, 285),
    "dam": (285, 360),
    "hasiwa": (360, 430),
    "owner": (430, 485),
    "notes": (485, 900),
}

AGE_RE = re.compile(r"^(ndama|s\.?kati|skati|kubwa|bado\s*kubwa)$", re.I)
SEX_RE = re.compile(r"^[MFmf]$")
HERENI_RE = re.compile(r"^\d{3}$")
SN_RE = re.compile(r"^\d{1,2}$")
OWNER_RE = re.compile(
    r"^(Mno|Mnokote|Kim|Kimw|Kimwala|Mnyk|Chibag|Chbg|Chibago|Mashk|Mshk|Mamk)$",
    re.I,
)
YES_RE = re.compile(r"^(Ndio|Ndiyo|Yes)$", re.I)
BREED_RE = re.compile(
    r"^(Sahiwal|Kisasa|Kienyeji|Nyankole|Boran|MBEGU|C|P)$", re.I
)


def col_of(x: float) -> str:
    for name, (a, b) in COL.items():
        if a <= x < b:
            return name
    return "notes"


def band_key(y: float, step: float = 12.0) -> float:
    return round(y / step) * step


def page_rows(page) -> list[dict[str, list[str]]]:
    words = page.get_text("words")  # x0,y0,x1,y1,word,...
    bands: dict[float, list] = {}
    for w in words:
        y = band_key(w[1])
        bands.setdefault(y, []).append(w)

    raw_rows: list[tuple[float, dict[str, list[str]], str]] = []
    for y in sorted(bands):
        cells: dict[str, list[str]] = {k: [] for k in COL}
        for w in sorted(bands[y], key=lambda t: t[0]):
            token = w[4].strip()
            if not token or set(token) <= set(".…·-_"):
                continue
            cells[col_of(w[0])].append(token)
        joined_h = " ".join(cells["hereni"])
        joined_sn = " ".join(cells["sn"])
        is_primary = bool(
            HERENI_RE.match(joined_h)
            or (
                SN_RE.match(joined_sn)
                and (
                    any(SEX_RE.match(t) for t in cells["sex"])
                    or any(AGE_RE.match(t) for t in cells["age"])
                    or HERENI_RE.match(joined_h)
                )
            )
        )
        # Partial primary: SN + age on one line, hereni+sex on next (Mashaka 039)
        is_partial = bool(
            SN_RE.match(joined_sn)
            and any(AGE_RE.match(t) for t in cells["age"])
            and not HERENI_RE.match(joined_h)
        ) or bool(
            HERENI_RE.match(joined_h)
            and not any(AGE_RE.match(t) for t in cells["age"])
            and (
                any(SEX_RE.match(t) for t in cells["sex"])
                or SN_RE.match(joined_sn)
            )
        )
        has_attr = bool(
            cells["hasiwa"]
            or cells["owner"]
            or any(YES_RE.match(t) for t in cells["notes"])
            or any(OWNER_RE.match(t) for t in cells["notes"])
            or any(SEX_RE.match(t) for t in cells["sex"])
            or any(AGE_RE.match(t) for t in cells["age"])
        )
        noise = any(
            t.lower()
            in ("summary", "jumla", "msimamizi", "maezo", "maelezo", "kienyeji", "sahiwal")
            for t in cells["sn"] + cells["hereni"] + cells["notes"] + cells["aina"]
        )
        if is_primary or is_partial:
            raw_rows.append((y, cells, "primary"))
        elif has_attr and not noise:
            raw_rows.append((y, cells, "attr"))

    # Merge close primary/attr bands into logical rows
    merged: list[dict[str, list[str]]] = []
    last_y: float | None = None

    def merge_into(prev: dict[str, list[str]], cells: dict[str, list[str]]) -> None:
        for k, vals in cells.items():
            prev[k].extend(vals)

    for y, cells, kind in raw_rows:
        hereni = pick_first(cells["hereni"], lambda t: HERENI_RE.match(t))
        if kind == "primary":
            # Attach to previous if previous lacks hereni and this is close
            if (
                merged
                and last_y is not None
                and y - last_y <= 22
                and not pick_first(merged[-1]["hereni"], lambda t: HERENI_RE.match(t))
                and hereni
            ):
                merge_into(merged[-1], cells)
            # Or previous has hereni but no age, and this band is attr-like continuation
            elif (
                merged
                and last_y is not None
                and y - last_y <= 22
                and pick_first(merged[-1]["hereni"], lambda t: HERENI_RE.match(t))
                and not pick_first(merged[-1]["age"], lambda t: AGE_RE.match(t))
                and not hereni
                and any(AGE_RE.match(t) for t in cells["age"])
            ):
                merge_into(merged[-1], cells)
            else:
                merged.append(cells)
                last_y = y
        elif last_y is not None and y - last_y <= 28 and merged:
            merge_into(merged[-1], cells)
        # else drop distant attr noise
    return merged


def pick_first(tokens: list[str], pred) -> str:
    for t in tokens:
        if pred(t):
            return t
    return ""


def parse_row(cells: dict[str, list[str]]) -> dict | None:
    hereni = pick_first(cells["hereni"], lambda t: HERENI_RE.match(t))
    sn = pick_first(cells["sn"], lambda t: SN_RE.match(t))
    if not hereni and sn:
        # sometimes hereni in sn col wrong; try padded
        if len(sn) <= 2:
            # look for 3-digit anywhere
            for col in cells.values():
                h = pick_first(col, lambda t: HERENI_RE.match(t))
                if h:
                    hereni = h
                    break
    if not hereni:
        return None

    sex = pick_first(cells["sex"], lambda t: SEX_RE.match(t)).upper()
    age = pick_first(cells["age"], lambda t: AGE_RE.match(t))
    if not age:
        age = pick_first(
            cells["aina"] + cells["notes"], lambda t: AGE_RE.match(t)
        )

    aina_parts = [t for t in cells["aina"] if BREED_RE.match(t) or not AGE_RE.match(t)]
    aina = " ".join(aina_parts).strip()

    dam = pick_first(cells["dam"], lambda t: HERENI_RE.match(t))
    hasiwa = pick_first(cells["hasiwa"], lambda t: YES_RE.match(t))
    mimba = ""
    if sex == "F" and hasiwa:
        mimba = hasiwa
        hasiwa = ""
    # also check notes for Mimba
    notes_tokens = cells["notes"][:]
    if any(re.match(r"^Mimba$", t, re.I) for t in notes_tokens):
        mimba = mimba or "Ndio"

    owner = pick_first(cells["owner"], lambda t: OWNER_RE.match(t))
    if not owner:
        owner = pick_first(
            cells["hasiwa"] + cells["notes"], lambda t: OWNER_RE.match(t)
        )

    notes = " ".join(
        t
        for t in notes_tokens
        if not OWNER_RE.match(t) and not YES_RE.match(t) and not HERENI_RE.match(t)
    ).strip()

    needs = not sex or not age
    return {
        "sn": sn,
        "hereni": hereni,
        "sex": sex,
        "ageClass": age,
        "aina": aina,
        "damHereni": dam,
        "sireHereni": "",
        "hasiwa": hasiwa if sex == "M" else "",
        "mimba": mimba if sex == "F" else "",
        "mmiliki": owner,
        "notes": notes,
        "source": "ocr",
        "needsReview": needs,
        "reviewReason": "PDF spatial parse — verify"
        if needs
        else "PDF spatial extract",
    }


def extract_meta(doc) -> dict:
    text = "\n".join(p.get_text() for p in doc)
    meta = {"location": "", "tagColor": "", "date": "", "supervisor": ""}
    m = re.search(r"(Nkonko[^\n]{0,40}|Idodoma[^\n]{0,40}|Matawa[^\n]{0,40})", text, re.I)
    if m:
        meta["location"] = re.sub(r"\s+", " ", m.group(1)).strip()
    for color in ("BLUE", "NJANO", "KIJANI", "NYEKUNDU", "NYEUPE"):
        if re.search(rf"\b{color}\b", text, re.I):
            meta["tagColor"] = color.upper()
            break
    dm = re.search(r"(\d{1,2}\s*/\s*\d{1,2}\s*/\s*\d{4})", text)
    if dm:
        meta["date"] = re.sub(r"\s+", "", dm.group(1))
    return meta


def summary_notes(doc) -> list[str]:
    out = []
    for page in doc:
        for line in page.get_text().splitlines():
            s = line.strip()
            if re.search(
                r"hazijawekewa|hajawekewa|Jumla|JUMLA|noted|Alikimbia|Maelezo:|haina|Zina Hereni",
                s,
                re.I,
            ):
                out.append(s)
    # dedupe
    seen = set()
    uniq = []
    for o in out:
        k = o.lower()
        if k in seen:
            continue
        seen.add(k)
        uniq.append(o)
    return uniq


def main() -> None:
    pdf = sys.argv[1]
    doc = fitz.open(pdf)
    animals: list[dict] = []
    seen: set[str] = set()
    for page in doc:
        for cells in page_rows(page):
            row = parse_row(cells)
            if not row:
                continue
            if row["hereni"] in seen:
                continue
            seen.add(row["hereni"])
            animals.append(row)

    animals.sort(key=lambda a: a["hereni"])
    print(
        json.dumps(
            {
                "animals": animals,
                "summaryNotes": summary_notes(doc),
                "method": "pymupdf-spatial",
                "meta": extract_meta(doc),
                "count": len(animals),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
