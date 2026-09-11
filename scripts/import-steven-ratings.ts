import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile();
} catch {
  /* .env missing is fine */
}

const prisma = new PrismaClient();
const SHEET_ID = "1F56l_YGbB_Xo3xBHa68z45IQj6Rkdf1ZlqnkfrfPY68";

/** Override the account to attach ratings to. Defaults to Steven's Google account. */
const DEFAULT_EMAIL = "stevenmarcher@gmail.com";

/** Target the account by email or by name (useful when the account has no email, e.g. OAuth-only). */
type Target = { email?: string; name?: string };

function parseTarget(): Target {
  const args = process.argv.slice(2);
  const flagEmail = args.find((a) => a.startsWith("--email="))?.slice("--email=".length);
  const flagName = args.find((a) => a.startsWith("--name="))?.slice("--name=".length);
  const envEmail = process.env.TARGET_EMAIL;
  const envName = process.env.TARGET_NAME;
  return {
    email: flagEmail ?? envEmail ?? (flagName ?? envName ? undefined : DEFAULT_EMAIL),
    name: flagName ?? envName,
  };
}

/** Each year tab of the Virtual Cinema spreadsheet. 2026 has no stable gid, so is fetched by sheet name. */
const YEARS: Array<{ year: number; gid?: number; sheet?: string }> = [
  { year: 2020, gid: 0 },
  { year: 2021, gid: 90514190 },
  { year: 2022, gid: 412769609 },
  { year: 2023, gid: 1619611114 },
  { year: 2024, gid: 2093457001 },
  { year: 2025, gid: 1823728345 },
  { year: 2026, sheet: "2026" },
];

/** The person's column header in the sheet, which may carry decoration (e.g. "Steven 🤓", "Wayne 🥂"). */
function sheetColumnFor(userName: string, email?: string | null): string {
  const lower = userName.toLowerCase();
  if (email === DEFAULT_EMAIL || lower.includes("steven")) return "Steven";
  if (lower.includes("dip")) return "Dip";
  const first = userName.split(/\s+/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Locate the Film column and the person's rating column by reading the header row — the layout differs per year tab. */
function findColumns(header: string[], sheetName: string): { filmCol: number; ratingCol: number } {
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

/**
 * Read a decimal rating, rounded to 2 dp. Accepts:
 *  - plain numbers ("3", "3.5", "4.25")
 *  - numbers decorated with emoji ("⭐️ 0.2 🤮")
 *  - old-style star strings ("***", "** 1/2", "*1/2") → 3 / 2.5 / 1.5
 * Returns null for empty cells, comments ("Adam Sandler is gaslighting us") and non-ratings ("N/A").
 */
function extractValue(raw: string | undefined): number | null {
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

async function fetchYear(year: { gid?: number; sheet?: string }): Promise<string[][]> {
  const res = await fetch(csvUrl(year), { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch gid ${year.gid ?? year.sheet}: ${res.status}`);
  return parseCsv(await res.text());
}

async function main() {
  const target = parseTarget();

  const user = target.email
    ? await prisma.user.findUnique({ where: { email: target.email } })
    : null;
  const userByName = user ?? (target.name ? await prisma.user.findFirst({ where: { name: { contains: target.name } } }) : null);
  if (!userByName || !userByName.name) {
    console.error(`User not found (email: ${target.email ?? "—"}, name: ${target.name ?? "—"}).`);
    process.exit(1);
  }
  console.log(`Target user: ${userByName.name}${userByName.email ? ` (${userByName.email})` : ""}`);

  const sheetName = sheetColumnFor(userByName.name, userByName.email ?? undefined);
  const ratings: Array<{ year: number; title: string; value: number }> = [];

  for (const cfg of YEARS) {
    const rows = await fetchYear(cfg);
    const header = rows[0] ?? [];
    const { filmCol, ratingCol } = findColumns(header, sheetName);
    let yearCount = 0;
    for (const row of rows.slice(1)) {
      const title = (row[filmCol] ?? "").trim();
      const value = extractValue(row[ratingCol]);
      if (!title || value === null) continue;
      ratings.push({ year: cfg.year, title, value });
      yearCount++;
    }
    console.log(`  ${cfg.year}: ${yearCount} ratings`);
  }

  console.log(`Parsed ${ratings.length} ${userByName.name} ratings across ${YEARS.length} year tabs.`);

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
        userId_screeningId: { userId: userByName.id, screeningId: screening.id },
      },
      select: { value: true },
    });
    await prisma.rating.upsert({
      where: {
        userId_screeningId: { userId: userByName.id, screeningId: screening.id },
      },
      update: { value: r.value },
      create: { userId: userByName.id, screeningId: screening.id, value: r.value },
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