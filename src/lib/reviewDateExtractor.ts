import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite asset import
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { DocType } from "./documents";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

export type ExtractType = DocType | "pdf";

// Label patterns (PT/EN with variations)
const LABEL_RE =
  /(data\s+da\s+(?:ú|u)ltima\s+revis(?:ã|a)o|(?:ú|u)ltima\s+revis(?:ã|a)o|review\s+date|last\s+review(?:ed)?|revis(?:ã|a)o\s+em)/i;

// Date patterns
const DATE_PATTERNS: RegExp[] = [
  /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/, // dd/mm/yyyy
  /\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/, // yyyy-mm-dd
];

const MONTHS_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, "março": 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
const MONTH_TEXT_RE = /\b(\d{1,2})\s+de\s+([a-zçãéíóú]+)\s+de\s+(\d{4})\b/i;

function tryParseDate(snippet: string): Date | null {
  // dd de Mes de yyyy
  const mt = snippet.match(MONTH_TEXT_RE);
  if (mt) {
    const day = +mt[1];
    const mon = MONTHS_PT[mt[2].toLowerCase()];
    const year = +mt[3];
    if (mon) {
      const d = new Date(year, mon - 1, day);
      if (!isNaN(d.getTime())) return d;
    }
  }
  for (const re of DATE_PATTERNS) {
    const m = snippet.match(re);
    if (!m) continue;
    let y: number, mo: number, d: number;
    if (re === DATE_PATTERNS[1]) {
      y = +m[1]; mo = +m[2]; d = +m[3];
    } else {
      d = +m[1]; mo = +m[2]; y = +m[3];
      if (y < 100) y += 2000;
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    const dt = new Date(y, mo - 1, d);
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

export function findReviewDateInText(text: string): Date | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, " ");
  // Search every label occurrence; date can be within ~80 chars after the label
  let idx = 0;
  while (idx < flat.length) {
    const sub = flat.slice(idx);
    const m = sub.match(LABEL_RE);
    if (!m || m.index === undefined) break;
    const start = idx + m.index + m[0].length;
    const window = flat.slice(start, start + 120);
    const date = tryParseDate(window);
    if (date) return date;
    idx = start + 1;
  }
  // Fallback: any date near a header line containing "revis"
  const lineMatch = flat.match(/revis[aã]o[^\d]{0,40}([\d\/\-.]{6,12})/i);
  if (lineMatch) {
    const d = tryParseDate(lineMatch[1]);
    if (d) return d;
  }
  return null;
}

async function extractDocxText(buf: ArrayBuffer): Promise<string> {
  const r = await mammoth.extractRawText({ arrayBuffer: buf });
  return r.value || "";
}

async function extractXlsxText(buf: ArrayBuffer): Promise<string> {
  const wb = XLSX.read(buf, { type: "array" });
  let out = "";
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    out += "\n" + XLSX.utils.sheet_to_csv(sheet, { FS: " | " });
  }
  return out;
}

async function extractPptxText(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const parts: string[] = [];
  const files = Object.keys(zip.files).filter(
    (n) => /^ppt\/(slides|notesSlides)\/.+\.xml$/.test(n)
  );
  for (const name of files) {
    const xml = await zip.files[name].async("string");
    parts.push(xml.replace(/<[^>]+>/g, " "));
  }
  return parts.join("\n");
}

async function extractPdfText(buf: ArrayBuffer): Promise<string> {
  const doc = await (pdfjsLib as any).getDocument({ data: buf }).promise;
  let out = "";
  const max = Math.min(doc.numPages, 20); // first 20 pages enough for headers/control tables
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    out += "\n" + tc.items.map((it: any) => it.str).join(" ");
  }
  await doc.cleanup?.();
  return out;
}

export async function extractText(file: File, type: ExtractType): Promise<string> {
  const buf = await file.arrayBuffer();
  switch (type) {
    case "docx": return extractDocxText(buf);
    case "xlsx": return extractXlsxText(buf);
    case "pptx": return extractPptxText(buf);
    case "pdf": return extractPdfText(buf);
  }
}

export async function extractReviewDate(file: File, type: ExtractType): Promise<Date | null> {
  try {
    const text = await extractText(file, type);
    return findReviewDateInText(text);
  } catch (e) {
    console.warn("extractReviewDate falhou", file.name, e);
    return null;
  }
}
