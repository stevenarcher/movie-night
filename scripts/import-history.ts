import { PrismaClient } from "@prisma/client";
import { tmdbPoster } from "../src/lib/tmdb.ts";

try {
  process.loadEnvFile();
} catch {
  /* .env missing is fine — TMDB token check below will complain */
}

const prisma = new PrismaClient();

const SHEET_ID = "1F56l_YGbB_Xo3xBHa68z45IQj6Rkdf1ZlqnkfrfPY68";

/**
 * The prior-year tabs of the Virtual Cinema spreadsheet. Each year's `week`
 * column holds the group's running week number (1..N) for that year's label.
 * Only 2025+ record real watch dates; earlier years get an anchored Monday.
 */
const YEARS: Array<{ year: number; gid: number; weekCol: number; filmCol: number; dateCol: number | null }> = [
  { year: 2025, gid: 1823728345, weekCol: 15, filmCol: 0, dateCol: 13 },
  { year: 2024, gid: 2093457001, weekCol: 0, filmCol: 1, dateCol: null },
  { year: 2023, gid: 1619611114, weekCol: 0, filmCol: 1, dateCol: null },
  { year: 2022, gid: 412769609, weekCol: 0, filmCol: 1, dateCol: null },
  { year: 2021, gid: 90514190, weekCol: 0, filmCol: 1, dateCol: null },
  { year: 2020, gid: 0, weekCol: 0, filmCol: 1, dateCol: null },
];

const MS_PER_DAY = 86_400_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Monday on/after... returns the Monday of the ISO week that contains Jan 4 of `year`, plus `extraWeeks`. */
function anchoredMonday(year: number, weekNumber: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(jan4.getTime() - jan4Day * MS_PER_DAY);
  return new Date(monday.getTime() + (weekNumber - 1) * 7 * MS_PER_DAY);
}

function parseDate(ddmmyyyy: string | undefined): Date | null {
  if (!ddmmyyyy) return null;
  const m = ddmmyyyy.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return Number.isNaN(d.getTime()) ? null : d;
}

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

const csvUrl = (gid: number) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;

async function fetchRows(gid: number): Promise<string[][]> {
  const res = await fetch(csvUrl(gid));
  if (!res.ok) throw new Error(`Failed to fetch gid=${gid}: ${res.status}`);
  return parseCsv(await res.text());
}

async function main() {
  const entries: Array<{ year: number; weekNumber: number; weekStart: Date; movieTitle: string }> = [];

  for (const cfg of YEARS) {
    const rows = await fetchRows(cfg.gid);
    console.log(`\n── ${cfg.year} (gid ${cfg.gid}: ${rows.length - 1} rows) ──`);

    const dated: Array<{ date: Date; movieTitle: string }> = [];
    const numbered: Array<{ week: number; movieTitle: string }> = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const film = (row[cfg.filmCol] ?? "").trim();
      if (!film) continue;

      if (cfg.dateCol !== null) {
        const date = parseDate(row[cfg.dateCol]);
        if (date) dated.push({ date, movieTitle: film });
      } else {
        const weekRaw = row[cfg.weekCol]?.trim() ?? "";
        if (!/^\d+$/.test(weekRaw)) continue;
        numbered.push({ week: Number(weekRaw), movieTitle: film });
      }
    }

    if (cfg.dateCol !== null) {
      dated.sort((a, b) => a.date.getTime() - b.date.getTime());
      dated.forEach((d, i) => {
        entries.push({ year: cfg.year, weekNumber: i + 1, weekStart: d.date, movieTitle: d.movieTitle });
      });
      console.log(`  parsed ${dated.length} screenings (dated)`);
    } else {
      for (const n of numbered) {
        entries.push({
          year: cfg.year,
          weekNumber: n.week,
          weekStart: anchoredMonday(cfg.year, n.week),
          movieTitle: n.movieTitle,
        });
      }
      console.log(`  parsed ${numbered.length} screenings (numbered)`);
    }
  }

  console.log(`\n${entries.length} historical screenings to import.`);

  let upserted = 0;
  let skipped = 0;
  const SLEEP_MS = 150;
  for (const e of entries) {
    try {
      const posterUrl = await tmdbPoster(e.movieTitle);
      await prisma.screening.upsert({
        where: { year_weekNumber: { year: e.year, weekNumber: e.weekNumber } },
        create: { ...e, metadata: { posterUrl: posterUrl ?? undefined } },
        update: {
          movieTitle: e.movieTitle,
          weekStart: e.weekStart,
          ...(posterUrl ? { metadata: { posterUrl } } : {}),
        },
      });
      upserted++;    } catch (err) {
      console.error(`  ✗ ${e.year} W${e.weekNumber} ${e.movieTitle} — ${(err as Error).message}`);
      skipped++;
    }
    await sleep(SLEEP_MS);
  }

  console.log(`\nDone! ${upserted} upserted, ${skipped} failed.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });