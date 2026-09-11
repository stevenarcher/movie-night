import { PrismaClient } from "@prisma/client";
import {
  extractValue,
  fetchYear,
  findColumns,
  sheetColumnFor,
  YEARS,
} from "./sheet.ts";

/** findColumns, but nullable — a person may not have a column in every year tab. */
function findColumnsSafe(
  header: string[],
  sheetName: string,
): { filmCol: number; ratingCol: number } | null {
  try {
    return findColumns(header, sheetName);
  } catch {
    return null;
  }
}

export type ImportResult = { inserted: number; updated: number; skipped: number };

/**
 * Pulls one person's ratings from every year tab of the Virtual Cinema
 * spreadsheet and upserts Rating rows against existing Screenings (matched by
 * year + case-insensitive title). Requires the target user to already exist.
 */
export async function importRatingsForUser(
  prisma: PrismaClient,
  user: { id: string; name: string; email?: string | null },
  log: (msg: string) => void = () => {},
): Promise<ImportResult> {
  const sheetName = sheetColumnFor(user.name, user.email);
  const ratings: Array<{ year: number; title: string; value: number }> = [];

  for (const cfg of YEARS) {
    const rows = await fetchYear(cfg);
    const header = rows[0] ?? [];
    const columns = findColumnsSafe(header, sheetName);
    if (!columns) {
      log(`  ${cfg.year}: no "${sheetName}" column — skipped`);
      continue;
    }
    const { filmCol, ratingCol } = columns;
    let yearCount = 0;
    for (const row of rows.slice(1)) {
      const title = (row[filmCol] ?? "").trim();
      const value = extractValue(row[ratingCol]);
      if (!title || value === null) continue;
      ratings.push({ year: cfg.year, title, value });
      yearCount++;
    }
    log(`  ${cfg.year}: ${yearCount} ratings`);
  }

  log(`Parsed ${ratings.length} ${user.name} ratings across ${YEARS.length} year tabs.`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const r of ratings) {
    const screening = await prisma.screening.findFirst({
      where: { year: r.year, movieTitle: { equals: r.title, mode: "insensitive" } },
      select: { id: true, weekNumber: true, movieTitle: true, watchOnVC: true },
    });
    if (!screening) {
      log(`  ✗ no Screening for ${r.year}: ${r.title}`);
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
      log(`  = ${r.year} W${screening.weekNumber} ${screening.movieTitle} = ${r.value} (already same)`);
    } else if (changed) {
      updated++;
      log(`  ↻ ${r.year} W${screening.weekNumber} ${screening.movieTitle} ${existing!.value} → ${r.value}`);
    } else {
      inserted++;
      log(`  ＋ ${r.year} W${screening.weekNumber} ${screening.movieTitle} = ${r.value}`);
    }
  }

  return { inserted, updated, skipped };
}