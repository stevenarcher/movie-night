import { PrismaClient } from "@prisma/client";
import { tmdbMeta } from "../src/lib/tmdb.ts";

try {
  process.loadEnvFile();
} catch {
  /* .env missing is fine — TMDB token check below will complain */
}

const prisma = new PrismaClient();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Meta = { posterUrl?: string; trailerUrl?: string; offers: unknown[]; [k: string]: unknown };

function hasPoster(metadata: unknown): boolean {
  const m = (metadata ?? {}) as { posterUrl?: unknown };
  return typeof m.posterUrl === "string" && m.posterUrl.length > 0;
}

async function enrich(title: string, label: string) {
  try {
    const meta = await tmdbMeta(title);
    if (!meta.posterUrl) {
      console.log(`  ${label} ✗ ${title} — no result with a poster`);
      return null;
    }
    const matchedYear = meta.matchedYear;
    const suspicious = Number(matchedYear) > 0 && Number(matchedYear) < 2023;
    const flag = suspicious ? " ⚠️ suspect year" : " ✓";
    console.log(`  ${label} ${title}\n      → "${meta.matchedTitle}" (${matchedYear}) ${flag}`);
    return { meta, suspicious };
  } catch (err) {
    console.error(`  ${label} ✗ ${title} — ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  const screenings = await prisma.screening.findMany({
    orderBy: [{ year: "asc" }, { weekNumber: "asc" }],
    select: { id: true, year: true, weekNumber: true, movieTitle: true, metadata: true },
  });
  const candidates = await prisma.candidate.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, metadata: true },
  });

  const screeningMissing = screenings.filter((s) => !hasPoster(s.metadata));
  const candidateMissing = candidates.filter((c) => !hasPoster(c.metadata));
  console.log(
    `Screenings: ${screenings.length} (${screenings.length - screeningMissing.length} have a poster)\n` +
      `Candidates: ${candidates.length} (${candidates.length - candidateMissing.length} have a poster)\n`,
  );

  let updated = 0;

  for (const s of screeningMissing) {
    const label = `${s.year} W${s.weekNumber}`;
    const result = await enrich(s.movieTitle, label);
    if (result?.meta.posterUrl) {
      const prev = (s.metadata as Meta | null) ?? {};
      await prisma.screening.update({
        where: { id: s.id },
        data: {
          metadata: {
            ...prev,
            posterUrl: result.meta.posterUrl,
            trailerUrl: result.meta.trailerUrl ?? undefined,
            offers: [],
          },
        },
      });
      updated++;
    }
    await sleep(150);
  }

  for (const c of candidateMissing) {
    const result = await enrich(c.title, "pool");
    if (result?.meta.posterUrl) {
      const prev = (c.metadata as Meta | null) ?? {};
      await prisma.candidate.update({
        where: { id: c.id },
        data: {
          metadata: {
            ...prev,
            posterUrl: result.meta.posterUrl,
            trailerUrl: result.meta.trailerUrl ?? undefined,
          },
        },
      });
      updated++;
    }
    await sleep(150);
  }

  console.log(`\nDone! ${updated} enriched (${screeningMissing.length} screenings + ${candidateMissing.length} candidates to process).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });