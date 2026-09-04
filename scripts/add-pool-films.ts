import { PrismaClient } from "@prisma/client";
import { tmdbMeta, tmdbOffers, tmdbTvMeta } from "../src/lib/tmdb.ts";
import { normalizeTitle } from "../src/whatsapp/normalize.ts";

try {
  process.loadEnvFile();
} catch {
  /* .env missing is fine — TMDB token check below will complain */
}

const prisma = new PrismaClient();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Titles to stage into the production candidate pool. `tv` marks entries that
 * resolve through TMDB's TV search (movie search won't surface them); everything
 * else is a film.
 */
const FILMS: Array<{ title: string; tv?: boolean }> = [
  { title: "Primitive War" },
  { title: "Black Phone 2" },
  { title: "Sunlight" },
  { title: "Caveat" },
  { title: "Beast" },
  { title: "Affection" },
  // Already staged as "Nirvanna the Band the Show the Movie" — spell it the same
  // so the dedupe recognises it and skips rather than adding a TV-series row.
  { title: "Nirvanna the Band the Show the Movie" },
  { title: "The Christophers" },
  { title: "Power Ballad" },
];

async function main() {
  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of FILMS) {
    const label = entry.tv ? "TV " : "film";
    const title = entry.title;
    const normalizedTitle = normalizeTitle(title);

    const existing = await prisma.candidate.findUnique({ where: { normalizedTitle } });
    if (existing) {
      console.log(`  skip ${label} "${title}" — already in pool (${existing.title})`);
      skipped++;
      continue;
    }

    try {
      const meta = entry.tv ? await tmdbTvMeta(title) : await tmdbMeta(title);
      if (!meta.posterUrl) {
        console.log(`  ✗ ${label} "${title}" — no poster match`);
        failed++;
        continue;
      }

      const offers =
        !entry.tv && "matchedId" in meta && typeof meta.matchedId === "number"
          ? await tmdbOffers(meta.matchedId, title)
          : [];

      await prisma.candidate.create({
        data: {
          title,
          normalizedTitle,
          source: "MANUAL",
          metadata: {
            posterUrl: meta.posterUrl,
            trailerUrl: meta.trailerUrl ?? undefined,
            offers,
          },
        },
      });
      console.log(
        `  ✓ ${label} "${title}"\n      → "${meta.matchedTitle}" (${meta.matchedYear}) poster + ${meta.trailerUrl ? "trailer" : "no trailer"}`,
      );
      added++;
    } catch (err) {
      console.error(`  ✗ ${label} "${title}" — ${(err as Error).message}`);
      failed++;
    }

    await sleep(150);
  }

  console.log(`\nDone! ${added} added, ${skipped} skipped (already in pool), ${failed} failed.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
