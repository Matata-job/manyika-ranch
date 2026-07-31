import fs from "fs";
import path from "path";
import { execFileSync, execSync } from "child_process";
import type { RawAnimalRow } from "./mapping";

/** Extract PDF literal Tj strings (annotations / typed overlays). */
export function extractPdfAnnotations(pdfPath: string): string[] {
  if (!fs.existsSync(pdfPath)) return [];
  const script = `
import re, sys
raw=open(sys.argv[1],'rb').read()
lit=re.findall(rb'\\(((?:\\\\.|[^\\\\\\(\\)])*)\\)\\s*Tj', raw)
outs=[]
for b in lit:
    try: s=b.decode('utf-8')
    except: s=b.decode('latin-1','ignore')
    s=s.replace('\\\\n',' ').replace('\\\\r','').replace('\\\\t',' ')
    s=re.sub(r'\\\\([\\\\()])', r'\\1', s).strip()
    if any(c.isalpha() for c in s) and len(s)>=2:
        outs.append(s)
seen=set(); uniq=[]
for o in outs:
    k=o.lower()
    if k in seen: continue
    seen.add(k); uniq.append(o)
print('\\n'.join(uniq))
`;
  const tmp = path.join("/tmp", `pdf-ann-${Date.now()}.py`);
  fs.writeFileSync(tmp, script);
  try {
    const out = execFileSync("python3", [tmp, pdfPath], {
      encoding: "utf8",
      maxBuffer: 5 * 1024 * 1024,
    });
    return out.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

export function untaggedFromAnnotations(lines: string[]): string[] {
  return lines.filter((l) =>
    /hazijawekewa|hajawekewa|bado.*hereni|alama|noted|mmoja haja/i.test(l)
  );
}

/**
 * OCR / extract animals from a PDF.
 * Prefer PyMuPDF text extraction (works for digital camp forms).
 * Fall back to tesseract / macOS Vision when text extract yields nothing.
 */
export function ocrPdfAnimals(pdfPath: string): {
  animals: RawAnimalRow[];
  ocrText: string;
  method: string;
} {
  if (!fs.existsSync(pdfPath)) {
    return { animals: [], ocrText: "", method: "missing" };
  }

  const root = path.join(process.cwd(), "scripts", "import-camps");
  const py = path.join(root, "parse_pdf_pymupdf.py");
  const libs = path.join(process.cwd(), ".python-libs");
  try {
    const out = execFileSync("python3", [py, pdfPath], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, PYTHONPATH: `${libs}:${process.env.PYTHONPATH || ""}` },
    });
    const parsed = JSON.parse(out) as {
      animals: RawAnimalRow[];
      summaryNotes?: string[];
      method: string;
    };
    // Prefer pymupdf even when 0 animals (empty/handwritten sheet) so notes are kept
    return {
      animals: parsed.animals || [],
      ocrText: out,
      method: parsed.method || "pymupdf-text",
    };
  } catch (e) {
    // continue to image OCR fallbacks
  }

  // Prefer tesseract + pdftoppm if installed
  try {
    execSync("which tesseract && which pdftoppm", { stdio: "ignore" });
    const dir = fs.mkdtempSync(path.join("/tmp", "camp-ocr-"));
    try {
      execFileSync(
        "pdftoppm",
        ["-png", "-r", "200", pdfPath, path.join(dir, "page")],
        { stdio: "ignore" }
      );
      const pages = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".png"))
        .sort();
      let text = "";
      for (const page of pages) {
        text +=
          execFileSync(
            "tesseract",
            [path.join(dir, page), "stdout", "-l", "eng"],
            { encoding: "utf8" }
          ) + "\n";
      }
      return {
        animals: parseOcrTableText(text),
        ocrText: text,
        method: "tesseract",
      };
    } finally {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* continue */
  }

  return {
    animals: [],
    ocrText: "",
    method: "no-text-extract",
  };
}

/** Heuristic parse of OCR lines into animal rows. */
export function parseOcrTableText(text: string): RawAnimalRow[] {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const animals: RawAnimalRow[] = [];
  const rowRe =
    /^(?:(\d{1,3})\s+)?(\d{3})\s+([MFmf])\s+(Ndama|S\.?\s*Kati|Skati|Kubwa|Bado\s*Kubwa)?\s*(.*)$/i;

  for (const line of lines) {
    if (/hereni|jinsia|summary|jumla|mmiliki|tarehe/i.test(line)) continue;
    const m = line.match(rowRe);
    if (!m) continue;
    const hereni = m[2];
    const sex = m[3];
    const age = m[4] || "";
    const rest = (m[5] || "").trim();
    // crude split of rest: breed ... owner
    let aina = rest;
    let owner = "";
    let notes = "";
    const ownerHit = rest.match(/\b(Mno|Kim|Mnyk|Chbg|Chibag|Mshk|Mamk)\b/i);
    if (ownerHit) {
      owner = ownerHit[1];
      const idx = rest.indexOf(ownerHit[0]);
      aina = rest.slice(0, idx).trim();
      notes = rest.slice(idx + ownerHit[0].length).trim();
    }
    animals.push({
      hereni,
      sex,
      ageClass: age,
      aina,
      mmiliki: owner,
      notes,
      source: "ocr",
      needsReview: true,
      reviewReason: "OCR-parsed — verify against sheet",
    });
  }

  // Fallback: lines that are just "001 M Kubwa Sahiwal"
  if (animals.length === 0) {
    for (const line of lines) {
      const m2 = line.match(
        /^(\d{3})\b.*?\b([MF])\b.*?\b(Ndama|S\.?\s*Kati|Kubwa)\b(.*)$/i
      );
      if (!m2) continue;
      animals.push({
        hereni: m2[1],
        sex: m2[2],
        ageClass: m2[3],
        aina: m2[4]?.trim() || "",
        source: "ocr",
        needsReview: true,
        reviewReason: "OCR loose match",
      });
    }
  }

  // Deduplicate by hereni
  const seen = new Set<string>();
  return animals.filter((a) => {
    if (seen.has(a.hereni)) return false;
    seen.add(a.hereni);
    return true;
  });
}
