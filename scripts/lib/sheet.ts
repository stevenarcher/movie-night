const SHEET_ID = "1F56l_YGbB_Xo3xBHa68z45IQj6Rkdf1ZlqnkfrfPY68";

export const DEFAULT_EMAIL = "stevenmarcher@gmail.com";

/** Each year tab of the Virtual Cinema spreadsheet. 2026 has no stable gid, so is fetched by sheet name. */
export const YEARS: Array<{ year: number; gid?: number; sheet?: string }> = [
  { year: 2020, gid: 0 },
  { year: 2021, gid: 90514190 },
  { year: 2022, gid: 412769609 },
  { year: 2023, gid: 1619611114 },
  { year: 2024, gid: 2093457001 },
  { year: 2025, gid: 1823728345 },
  { year: 2026, sheet: "2026" },
];

/**
 * The person's column header in the sheet, which may carry decoration
 * (e.g. "Steven 🤓", "Wayne 🥂"). Resolved from the account name/email.
 */
export function sheetColumnFor(userName: string, email?: string | null): string {
  const lower = userName.toLowerCase();
  if (email === DEFAULT_EMAIL || lower.includes("steven")) return "Steven";
  if (lower.includes("dip")) return "Dip";
  const first = userName.split(/\s+/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Locate the Film column and the person's rating column by reading the header row — the layout differs per year tab. */
export function findColumns(header: string[], sheetName: string): { filmCol: number; ratingCol: number } {
  const filmCol = header.findIndex((h) => h.trim().toLowerCase() === "film");
  const ratingCol = header.findIndex((h) => h.trim().startsWith(sheetName));
  if (filmCol === -1 || ratingCol === -1) {
    throw new Error(
      `Couldn't locate Film / "${sheetName}" columns in header: [${header.join(", ")}]`,
    );
  }
  return { filmCol, ratingCol };
}

/** Tiny RFC-4180-style CSV parser (handles quoted fields, embedded commas & newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Read a decimal rating, rounded to 2 dp. Accepts:
 *  - plain numbers ("3", "3.5", "4.25")
 *  - numbers decorated with emoji ("⭐️ 0.2 🤮")
 *  - old-style star strings ("***", "** 1/2", "*1/2") → 3 / 2.5 / 1.5
 * Returns null for empty cells, comments ("Adam Sandler is gaslighting us") and non-ratings ("N/A").
 */
export function extractValue(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  const stars = s.match(/^(\*+)\s*(1\/2)?$/);
  if (stars) {
    return stars[1].length + (stars[2] ? 0.5 : 0);
  }

  const cleaned = s.replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function csvUrl(year: { gid?: number; sheet?: string }): string {
  return year.gid !== undefined
    ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${year.gid}`
    : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${year.sheet}`;
}

export async function fetchYear(year: { gid?: number; sheet?: string }): Promise<string[][]> {
  const res = await fetch(csvUrl(year), { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch gid ${year.gid ?? year.sheet}: ${res.status}`);
  return parseCsv(await res.text());
}