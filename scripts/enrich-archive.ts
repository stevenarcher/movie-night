import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile();
} catch {
  /* .env missing is fine — TMDB token check below will complain */
}

const prisma = new PrismaClient();

const TOKEN = process.env.TMDB_READ_TOKEN;
if (!TOKEN) {
  console.error("TMDB_READ_TOKEN is not set in .env");
  process.exit(1);
}

const IMG_URL = (path: string) => `https://image.tmdb.org/t/p/w500${path}`;

type SearchResult = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
};

/** Query overrides for titles TMDB spells differently. */
const QUERY_OVERRIDES: Record<string, string> = {
  "Luc Besson's Dracula": "Dracula: A Love Tale",
  "Greenland Migration": "Greenland: Migration",
  "Sisu Road to Revenge": "Sisu: Road to Revenge",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tmdbSearch(query: string): Promise<SearchResult[]> {
  const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&include_adult=true&language=en-US&page=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`search failed (${res.status}) for "${query}"`);
  const data = (await res.json()) as { results: SearchResult[] };
  return data.results;
}

async function tmdbDetails(id: number) {
  const url = `https://api.themoviedb.org/3/movie/${id}?append_to_response=videos&language=en-US`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`details failed (${res.status}) for id ${id}`);
  return res.json();
}

function bestMatch(results: SearchResult[]): SearchResult | null {
  const withPoster = results.filter((r) => r.poster_path);
  if (withPoster.length === 0) return null;
  const year = (r: SearchResult) => Number(r.release_date?.slice(0, 4)) || 0;
  const latest = withPoster.filter((r) => year(r) >= 2023);
  return latest[0] ?? withPoster[0];
}

function pickTrailer(details: { videos?: { results?: Array<{ site?: string; type?: string; official?: boolean; key?: string }> } }): string | null {
  const videos = details.videos?.results ?? [];
  const youtube = videos.filter((v) => v.site === "YouTube" && v.type === "Trailer" && v.key);
  const official = youtube.find((v) => v.official) ?? youtube[0];
  return official?.key ? `https://www.youtube.com/watch?v=${official.key}` : null;
}

async function main() {
  const screenings = await prisma.screening.findMany({
    orderBy: { weekNumber: "asc" },
    select: { id: true, weekNumber: true, movieTitle: true, metadata: true },
  });

  const enrichedCount = screenings.filter(
    (s) => (s.metadata as { posterUrl?: string } | null)?.posterUrl,
  ).length;
  console.log(`Loaded ${screenings.length} screenings (${enrichedCount} already have a poster).\n`);

  let updated = 0;
  const notFound: string[] = [];

  for (const s of screenings) {
    const query = QUERY_OVERRIDES[s.movieTitle] ?? s.movieTitle;

    try {
      const results = await tmdbSearch(query);
      const match = bestMatch(results);

      if (!match) {
        notFound.push(s.movieTitle);
        console.log(`  W${s.weekNumber} ✗ ${s.movieTitle} — no result with a poster`);
        await sleep(150);
        continue;
      }

      const details = (await tmdbDetails(match.id)) as {
        videos?: { results?: Array<{ site?: string; type?: string; official?: boolean; key?: string }> };
      };
      const trailerUrl = pickTrailer(details);
      const matchedYear = match.release_date?.slice(0, 4) ?? "????";

      // Flag likely-wrong matches (old films when we expect a recent release).
      const suspicious = Number(matchedYear) > 0 && Number(matchedYear) < 2023;
      const flag = suspicious ? " ⚠️ suspect year" : " ✓";

      await prisma.screening.update({
        where: { id: s.id },
        data: {
          metadata: {
            posterUrl: IMG_URL(match.poster_path!),
            trailerUrl,
            offers: [],
          },
        },
      });
      updated++;
      console.log(
        `  W${s.weekNumber} ${s.movieTitle}\n      → "${match.title}" (${matchedYear}) ${flag}\n      ${trailerUrl ? `trailer: ${trailerUrl}` : "(no trailer found)"}`,
      );
    } catch (err) {
      console.error(`  W${s.weekNumber} ✗ ${s.movieTitle} — ${(err as Error).message}`);
    }

    await sleep(150);
  }

  console.log(`\nDone! ${updated}/${screenings.length} enriched.`);
  if (notFound.length) console.log(`No TMDB result: ${notFound.join(", ")}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });