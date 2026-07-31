/**
 * Permanent Manyika Ranch camp registry.
 * Camp codes (MR-nn) never change when supervisors change.
 * legacyCode = Sept 2025 sheet codes based on then-current supervisors.
 */

export type CampManifestEntry = {
  code: string; // MR-01
  name: string;
  legacyCode: string;
  tagColor?: string;
  locationHint?: string;
  supervisorName?: string;
  supervisorEmail?: string;
  /** Prefer DOCX when present; else PDF OCR */
  docxRelPaths: string[];
  pdfRelPaths: string[];
};

const RECORDS =
  "/Users/john/Desktop/cattle Project/Manyika Ranch/CAMP RECORD SEPT 2025";

export const RECORDS_ROOT = RECORDS;
export const KAMBI_RECORDS = `${RECORDS}/KAMBI RECORDS`;
export const PDF_BUNDLE = `${RECORDS}/1 ZOTE ZIPO HAPA`;

export const CAMP_MANIFEST: CampManifestEntry[] = [
  {
    code: "MR-01",
    name: "Gidion Kwa Mwilwa",
    legacyCode: "GID01",
    tagColor: "NJANO",
    locationHint: "Nkonko, Idodoma, kijijini kwa sai",
    supervisorName: "John Sadallah",
    supervisorEmail: "supervisor.mr01@manyikaranch.co.tz",
    docxRelPaths: [
      `${KAMBI_RECORDS}/Kambi Namba 01  -    GID01/CAMP 01 - Gidion Kwa Mwilwa (GID01 ).docx`,
    ],
    pdfRelPaths: [`${PDF_BUNDLE}/CAMP 01 - Gidion Kwa Mwilwa (GID01 ).pdf`],
  },
  {
    code: "MR-02",
    name: "Mashaka",
    legacyCode: "MSHK02",
    tagColor: "BLUE",
    locationHint: "Nkonko, Matawa / kafuru",
    supervisorName: "Mashaka Cosmas",
    supervisorEmail: "supervisor.mr02@manyikaranch.co.tz",
    docxRelPaths: [
      `${KAMBI_RECORDS}/Kambi Namba 02  -    MSHK02/CAMP 02 - Mashaka (MSHK02).docx`,
    ],
    pdfRelPaths: [`${PDF_BUNDLE}/CAMP 02 - Mashaka (MSHK02).pdf`],
  },
  {
    code: "MR-03",
    name: "Bosko Chiumbo",
    legacyCode: "BOSK03",
    tagColor: "BLUE",
    locationHint: "Nkonko, Chiumbo",
    supervisorName: "Dismas Chiumbo",
    supervisorEmail: "supervisor.mr03@manyikaranch.co.tz",
    docxRelPaths: [
      `${KAMBI_RECORDS}/Kambi Namba 03  -    BOSK03/CAMP 03 - Bosko Chiumbo  (BOSK03).docx`,
    ],
    pdfRelPaths: [`${PDF_BUNDLE}/CAMP 03 - Bosko Chiumbo  (BOSK03).pdf`],
  },
  {
    code: "MR-04",
    name: "Boni",
    legacyCode: "BON04",
    tagColor: "NJANO",
    locationHint: "Rukasana, Pemb",
    supervisorName: "Boni Supirian",
    supervisorEmail: "supervisor.mr04@manyikaranch.co.tz",
    docxRelPaths: [
      `${KAMBI_RECORDS}/Kambi Namba 04  -    BON04/CAMP 04 - Boni  (BON04) FINAL PAGE.docx`,
      `${KAMBI_RECORDS}/Kambi Namba 04  -    BON04/CAMP 04 - Boni  (BON04).docx`,
    ],
    pdfRelPaths: [`${PDF_BUNDLE}/CAMP 04 - Boni  (BON04).pdf`],
  },
  {
    code: "MR-05",
    name: "Gwanda",
    legacyCode: "GWND05",
    tagColor: "KIJANI",
    locationHint: "Nkonko, Chiumbo",
    supervisorName: "Gwanda",
    supervisorEmail: "supervisor.mr05@manyikaranch.co.tz",
    docxRelPaths: [
      `${KAMBI_RECORDS}/Kambi Namba 05  -    GWND05/CAMP 05 - Gwanda  (GWND05).docx`,
    ],
    pdfRelPaths: [`${PDF_BUNDLE}/CAMP 05 - Gwanda  (GWND05).pdf`],
  },
  {
    code: "MR-06",
    name: "Chipanta",
    legacyCode: "CHPT06",
    tagColor: "NJANO",
    locationHint: "Nkonko",
    supervisorName: "Chipanta",
    supervisorEmail: "supervisor.mr06@manyikaranch.co.tz",
    docxRelPaths: [],
    pdfRelPaths: [`${PDF_BUNDLE}/CAMP 06 - Chipanta  (CHPT06).pdf`],
  },
  {
    code: "MR-07",
    name: "Mwanampiti",
    legacyCode: "MWNP07",
    supervisorName: "Mwanampiti",
    supervisorEmail: "supervisor.mr07@manyikaranch.co.tz",
    docxRelPaths: [
      `${KAMBI_RECORDS}/Kambi Namba 07  -    MWNP07/CAMP 07 - Mwanampiti (MWNP07).docx`,
    ],
    pdfRelPaths: [`${PDF_BUNDLE}/CAMP 07 - Mwanampiti (MWNP07).pdf`],
  },
  {
    code: "MR-08",
    name: "Chugulu",
    legacyCode: "CHUG08",
    supervisorName: "Said Omar",
    supervisorEmail: "supervisor.mr08@manyikaranch.co.tz",
    docxRelPaths: [
      `${KAMBI_RECORDS}/Kambi Namba 08  -    CHUG08/CAMP 08 - Chugulu (CHUG08 ).docx`,
    ],
    pdfRelPaths: [`${PDF_BUNDLE}/CAMP 08 - Chugulu (CHUG08 ).pdf`],
  },
  {
    code: "MR-09",
    name: "Siida",
    legacyCode: "Siida09",
    supervisorName: "Siida",
    supervisorEmail: "supervisor.mr09@manyikaranch.co.tz",
    docxRelPaths: [],
    pdfRelPaths: [`${PDF_BUNDLE}/CAMP 09 - Siida  (Siida09).pdf`],
  },
  {
    code: "MR-10",
    name: "Isdory",
    legacyCode: "ISD10",
    supervisorName: "Isdory",
    supervisorEmail: "supervisor.mr10@manyikaranch.co.tz",
    docxRelPaths: [
      `${KAMBI_RECORDS}/Kambi Namba 10  -    ISD10/CAMP 10 - Isdory  (ISD10).docx`,
    ],
    pdfRelPaths: [`${PDF_BUNDLE}/CAMP 10 - Isdory  (ISD10).pdf`],
  },
  {
    code: "MR-11",
    name: "Miraji",
    legacyCode: "MRJ11",
    supervisorName: "Miraji",
    supervisorEmail: "supervisor.mr11@manyikaranch.co.tz",
    docxRelPaths: [],
    pdfRelPaths: [`${PDF_BUNDLE}/CAMP 11 - Miraji  (MRJ11).pdf`],
  },
  {
    code: "MR-12",
    name: "Nyau",
    legacyCode: "NYAU12",
    supervisorName: "Nyau",
    supervisorEmail: "supervisor.mr12@manyikaranch.co.tz",
    docxRelPaths: [],
    pdfRelPaths: [`${PDF_BUNDLE}/CAMP 12 - Nyau  (NYAU12).pdf`],
  },
  {
    code: "MR-13",
    name: "Mahona",
    legacyCode: "MAHN13",
    supervisorName: "Mahona",
    supervisorEmail: "supervisor.mr13@manyikaranch.co.tz",
    docxRelPaths: [],
    pdfRelPaths: [`${PDF_BUNDLE}/CAMP 13 - Mahona  (MAHN13).pdf`],
  },
  {
    code: "MR-14",
    name: "Christopher",
    legacyCode: "CHRST14",
    supervisorName: "Christopher",
    supervisorEmail: "supervisor.mr14@manyikaranch.co.tz",
    docxRelPaths: [
      `${KAMBI_RECORDS}/Kambi Namba 14 -    CHRST14/CAMP 14 - Christopher  (CHRST14).docx`,
    ],
    pdfRelPaths: [`${PDF_BUNDLE}/CAMP 14 - Christopher  (CHRST14).pdf`],
  },
];

export function formatEartag(campCode: string, hereni: string | number): string {
  const n = String(hereni).replace(/\D/g, "").padStart(3, "0");
  return `${campCode}-${n}`;
}
