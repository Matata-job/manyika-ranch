import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import type { RawAnimalRow } from "./mapping";

/** Parse animal tables from a camp DOCX. Returns empty if template-only. */
export function parseDocxAnimals(docxPath: string): {
  animals: RawAnimalRow[];
  summaryNotes: string[];
} {
  if (!fs.existsSync(docxPath)) return { animals: [], summaryNotes: [] };

  const script = `
import zipfile, json, sys
from xml.etree import ElementTree as ET
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
path=sys.argv[1]
def cell_text(cell):
    return ' '.join(''.join(t.text or '' for t in cell.iter(W+'t')).split())
with zipfile.ZipFile(path) as z:
    root=ET.fromstring(z.read('word/document.xml'))
animals=[]
notes=[]
for p in root.iter(W+'p'):
    line=''.join(t.text or '' for t in p.iter(W+'t')).strip()
    if line and any(k in line.lower() for k in ['hazijawekewa','hajawekewa','summary','jumla','alama']):
        notes.append(line)
for tbl in root.iter(W+'tbl'):
    for tr in tbl.findall(W+'tr'):
        cells=[cell_text(tc) for tc in tr.findall(W+'tc')]
        if len(cells) < 4: continue
        hereni=cells[1].strip() if len(cells)>1 else ''
        if not hereni.isdigit(): continue
        sex=cells[2] if len(cells)>2 else ''
        age=cells[3] if len(cells)>3 else ''
        aina=cells[4] if len(cells)>4 else ''
        parents=cells[5] if len(cells)>5 else ''
        hasiwa=cells[6] if len(cells)>6 else ''
        mimba=cells[7] if len(cells)>7 else ''
        owner=cells[8] if len(cells)>8 else ''
        note=cells[9] if len(cells)>9 else ''
        if len(cells) >= 11:
            hasiwa=cells[6]; mimba=cells[7]; owner=cells[8]; note=cells[9] if cells[9] else cells[10]
        dam=''; sire=''
        if parents:
            parts=[p.strip() for p in parents.replace('|',' ').split() if p.strip()]
            if parts: dam=parts[0]
            if len(parts)>1: sire=parts[1]
        animals.append({
            'sn': cells[0],
            'hereni': hereni,
            'sex': sex,
            'ageClass': age,
            'aina': aina,
            'damHereni': dam,
            'sireHereni': sire,
            'hasiwa': hasiwa,
            'mimba': mimba,
            'mmiliki': owner,
            'notes': note,
            'source': 'docx',
        })
print(json.dumps({'animals': animals, 'summaryNotes': notes}))
`;
  const tmp = path.join("/tmp", `parse-docx-${Date.now()}.py`);
  fs.writeFileSync(tmp, script);
  try {
    const out = execFileSync("python3", [tmp, docxPath], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(out) as {
      animals: RawAnimalRow[];
      summaryNotes: string[];
    };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

export function pickBestDocx(paths: string[]): string | null {
  let best: { path: string; count: number } | null = null;
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    const { animals } = parseDocxAnimals(p);
    if (!best || animals.length > best.count) {
      best = { path: p, count: animals.length };
    }
  }
  return best && best.count > 0 ? best.path : null;
}
