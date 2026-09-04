import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile();
} catch {
  /* .env missing is fine */
}

/** Override for the account to attach ratings to. Defaults to Steven's Google account. */
const TARGET_EMAIL = process.env.TARGET_EMAIL ?? "stevenmarcher@gmail.com";

const prisma = new PrismaClient();
const SHEET_ID = "1F56l_YGbB_Xo3xBHa68z45IQj6Rkdf1ZlqnkfrfPY68";

const YEARS: Array<{ year: number; gid: number }> = [
  { year: 2020, gid: 0 },
  { year: 2021, gid: 90514190 },
  { year: 2022, gid: 412769609 },
];

/** Steven's per-person rating column index in each year's tab. */
const STEVEN_COL = 10;

/** Tiny RFC-4180-style CSV parser (handles quoted fields, embedded commas & newlines). */
function parseCsv(text: string): string[][] {
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

/** Strip decoration (star/emoji) and read the decimal rating, rounded to 2 dp. */
function extractValue(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

async function fetchYear(gid: number): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch gid ${gid}: ${res.status}`);
  return parseCsv(await res.text());
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } });
  if (!user) {
    console.error(`User not found for email: ${TARGET_EMAIL}`);
    process.exit(1);
  }

  const ratings: Array<{ year: number; title: string; value: number }> = [];

  for (const { year, gid } of YEARS) {
    const rows = await fetchYear(gid);
    // Film column: 2020-2022 use index 1
    for (const row of rows.slice(1)) {
      const title = (row[1] ?? "").trim();
      const value = extractValue(row[STEVEN_COL]);
      if (!title || value === null) continue;
      ratings.push({ year, title, value });
    }
  }

  console.log(`Parsed ${ratings.length} Steven ratings (2020-2022).`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const r of ratings) {
    const screening = await prisma.screening.findFirst({
      where: { year: r.year, movieTitle: { equals: r.title, mode: "insensitive" } },
      select: { id: true, weekNumber: true, movieTitle: true, watchOnVC: true },
    });
    if (!screening) {
      console.log(`  ✗ no Screening for ${r.year}: ${r.title}`);
      skipped++;
      continue;
    }
    const existing = await prisma.rating.findUnique({
      where: {
        userId_screeningId: { userId: user.id, screeningId: screening.id },
      },
      select: { value: true },
    });
    await prisma.rating.upsert({
      where: {
        userId_screeningId: { userId: user.id, screeningId: screening.id },
      },
      update: { value: r.value },
      create: { userId: user.id, screeningId: screening.id, value: r.value },
    });
    const changed = existing && existing.value !== r.value;
    if (existing && !changed) {
      console.log(`  = ${r.year} W${screening.weekNumber} ${screening.movieTitle} = ${r.value} (already same)`);
    } else if (changed) {
      updated++;
      console.log(`  ↻ ${r.year} W${screening.weekNumber} ${screening.movieTitle} ${existing!.value} → ${r.value}`);
    } else {
      inserted++;
      console.log(`  ＋ ${r.year} W${screening.weekNumber} ${screening.movieTitle} = ${r.value}`);
    }
  }

  console.log(`\nDone! ${inserted} inserted, ${updated} updated, ${skipped} skipped.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
