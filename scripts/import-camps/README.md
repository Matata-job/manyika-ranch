# Manyika camp records import

Permanent camp codes use **`MR-01` … `MR-14`** (never supervisor names).  
Eartags: **`MR-01-001`**. Legacy sheet codes (`GID01`, `MSHK02`, …) are stored on the camp as `legacyCode` / notes only.

## Commands

```bash
# 1) Parse DOCX + PDF text extract → data/imports/mr-*.json
npm run camps:build
# or one camp / skip PDF extract:
npx tsx scripts/import-camps/cli.ts build --camp MR-01
npx tsx scripts/import-camps/cli.ts build --skip-ocr

# 2) Review counts + needsReview list
npm run camps:dry-run
# → data/imports/_report.json
# → data/imports/_needs_review.json

# 3) Wipe demo herd and load JSON into DB
npm run camps:apply
```

Default password for newly created supervisors / external owners: `admin123`.

## Sources

- Filled Word tables preferred when present: Gidion (`MR-01`), Chugulu (`MR-08`)
- Other camps: PyMuPDF spatial text extract from Sept 2025 PDFs (`.python-libs` local install)
- Untagged / summary lines (`Hazijawekewa Alama`, `Jumla`, …) → camp `notes`, not fake eartags
- Miraji (`MR-11`): sheet is handwritten/vector-only — camp created with Jumla note; no animals until manual entry
