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
 * The year tabs of the Virtual Cinema spreadsheet. Each year's `week` column
 * holds the group's running week number (1..N) for that year's VC picks, but it
 * is unreliable (it counts non-VC rows too and is sparsely filled), so VC weeks
 * are always renumbered consecutively to count only real VC picks. 2025+ record
 * real watch dates; earlier years get an anchored Monday.
 *
 * The "watched" flag distinguishes the weekly VC pick (TRUE) from non-VC films
 * (FALSE/empty) that were watched or considered but never the featured pick. The
 * column index differs per layout: index 3 for 2020–2025, but the 2026 tab uses
 * a renamed `Watched on VC` column at index 1.
 */
const YEARS: Array<{
  year: number;
  gid?: number;
  sheet?: string;
  watchedCol: number;
  weekCol: number;
  filmCol: number;
  dateCol: number | null;
}> = [
  { year: 2026, sheet: "2026", watchedCol: 1, weekCol: 13, filmCol: 0, dateCol: 11 },
  { year: 2025, gid: 1823728345, watchedCol: 3, weekCol: 15, filmCol: 0, dateCol: 13 },
  { year: 2024, gid: 2093457001, watchedCol: 3, weekCol: 0, filmCol: 1, dateCol: null },
  { year: 2023, gid: 1619611114, watchedCol: 3, weekCol: 0, filmCol: 1, dateCol: null },
  { year: 2022, gid: 412769609, watchedCol: 3, weekCol: 0, filmCol: 1, dateCol: null },
  { year: 2021, gid: 90514190, watchedCol: 3, weekCol: 0, filmCol: 1, dateCol: null },
  { year: 2020, gid: 0, watchedCol: 3, weekCol: 0, filmCol: 1, dateCol: null },
];
/** Non-VC films share the Screening table; give them a synthetic week number far
 *  above any real weekly slot so the (year, weekNumber) unique key never collides
 *  and ordering within the year stays stable. The UI hides the number for non-VC. */
const NON_VC_WEEK_BASE = 10_000;

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

function isWatched(watched: string | undefined): boolean {
  return (watched ?? "").trim().toUpperCase() === "TRUE";
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

const csvUrl = (cfg: { gid?: number; sheet?: string }) =>
  cfg.gid !== undefined
    ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${cfg.gid}`
    : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${cfg.sheet}`;

async function fetchRows(cfg: { gid?: number; sheet?: string }): Promise<string[][]> {
  const res = await fetch(csvUrl(cfg));
  if (!res.ok) throw new Error(`Failed to fetch sheet ${cfg.sheet ?? cfg.gid}: ${res.status}`);
  return parseCsv(await res.text());
}

type Entry = {
  year: number;
  weekNumber: number;
  weekStart: Date | null;
  movieTitle: string;
  watchOnVC: boolean;
};

async function main() {
  const entries: Entry[] = [];

  for (const cfg of YEARS) {
    const rows = await fetchRows(cfg);
    console.log(`\n── ${cfg.year} (${cfg.sheet ?? `gid ${cfg.gid}`}: ${rows.length - 1} rows) ──`);

    const vcDated: Array<{ date: Date; movieTitle: string }> = [];
    const vcNumbered: Array<{ week: number; movieTitle: string }> = [];
    const nonVc: Array<{ movieTitle: string }> = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const film = (row[cfg.filmCol] ?? "").trim();
      if (!film) continue;

      if (!isWatched(row[cfg.watchedCol])) {
        nonVc.push({ movieTitle: film });
        continue;
      }

      if (cfg.dateCol !== null) {
        const date = parseDate(row[cfg.dateCol]);
        if (date) vcDated.push({ date, movieTitle: film });
      } else {
        const weekRaw = row[cfg.weekCol]?.trim() ?? "";
        if (!/^\d+$/.test(weekRaw)) continue;
        vcNumbered.push({ week: Number(weekRaw), movieTitle: film });
      }
    }

    let vcCount = 0;
    if (cfg.dateCol !== null) {
      vcDated.sort((a, b) => a.date.getTime() - b.date.getTime());
      vcDated.forEach((d, i) => {
        entries.push({
          year: cfg.year,
          weekNumber: i + 1,
          weekStart: d.date,
          movieTitle: d.movieTitle,
          watchOnVC: true,
        });
        vcCount++;
      });
      console.log(`  ${vcCount} VC screenings (dated)`);
    } else {
      // The spreadsheet's Week column runs a sequence across VC and non-VC rows
      // alike, so its values have gaps wherever a non-VC film sits. Sort the VC
      // films by that raw value (chronological) but renumber them consecutively
      // 1..N so non-VC films never consume a weekly slot.
      vcNumbered.sort((a, b) => a.week - b.week);
      vcNumbered.forEach((n, i) => {
        entries.push({
          year: cfg.year,
          weekNumber: i + 1,
          weekStart: anchoredMonday(cfg.year, i + 1),
          movieTitle: n.movieTitle,
          watchOnVC: true,
        });
        vcCount++;
      });
      console.log(`  ${vcCount} VC screenings (numbered)`);
    }

    nonVc.forEach((f, i) => {
      entries.push({
        year: cfg.year,
        weekNumber: NON_VC_WEEK_BASE + i + 1,
        weekStart: null,
        movieTitle: f.movieTitle,
        watchOnVC: false,
      });
    });
    console.log(`  ${nonVc.length} non-VC films`);
  }

  console.log(`\n${entries.length} historical screenings to import.`);
  const vcTotal = entries.filter((e) => e.watchOnVC).length;
  const nonVcTotal = entries.length - vcTotal;
  console.log(`  ${vcTotal} watchOnVC, ${nonVcTotal} non-VC.`);

  console.log("\nDeleting existing imported-year screenings (incl. 2026 spreadsheet history; ratings untouched)...");
  const deleted = await prisma.screening.deleteMany({
    where: { year: { in: YEARS.map((y) => y.year) } },
  });
  console.log(`  deleted ${deleted.count} rows.`);

  let upserted = 0;
  let skipped = 0;
  const SLEEP_MS = 150;
  for (const e of entries) {
    try {
      const posterUrl = await tmdbPoster(e.movieTitle);
      await prisma.screening.upsert({
        where: { year_weekNumber: { year: e.year, weekNumber: e.weekNumber } },
        create: {
          year: e.year,
          weekNumber: e.weekNumber,
          weekStart: e.weekStart,
          movieTitle: e.movieTitle,
          watchOnVC: e.watchOnVC,
          metadata: { posterUrl: posterUrl ?? undefined },
        },
        update: {
          movieTitle: e.movieTitle,
          weekStart: e.weekStart,
          watchOnVC: e.watchOnVC,
          ...(posterUrl ? { metadata: { posterUrl } } : {}),
        },
      });
      upserted++;
    } catch (err) {
      const weekLabel = e.watchOnVC
        ? `${e.year} W${e.weekNumber}`
        : `${e.year} (non-VC)`;
      console.error(`  ✗ ${weekLabel} ${e.movieTitle} — ${(err as Error).message}`);
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
