import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { movieMeta, type Offer } from "@/lib/movie-meta";
import { currentWeek } from "@/lib/week";

// ---------------------------------------------------------------------------
// Cache tags — invalidated by the API routes / server actions that mutate the
// underlying tables. `revalidateTag` uses stale-while-revalidate, so returning
// visitors get the last-good content instantly while fresh data loads.
// ---------------------------------------------------------------------------
export const TAG_CANDIDATES = "candidates";
export const TAG_ARCHIVE = "archive";
export const TAG_SELECTION = "selection";

// Keep the serialized "where to watch" chips bounded — a handful of providers
// is plenty for the UI and keeps the RSC payload per movie small.
const MAX_OFFERS = 10;

function capOffers(offers: Offer[]): Offer[] {
  return offers.length > MAX_OFFERS ? offers.slice(0, MAX_OFFERS) : offers;
}

// ---------------------------------------------------------------------------
// Candidate pool (shared by /pool and /choose)
// ---------------------------------------------------------------------------

export type CachedCandidate = {
  id: string;
  title: string;
  source: "WHATSAPP" | "MANUAL";
  createdAt: string;
  posterUrl: string | null;
  trailerUrl: string | null;
  offers: Offer[];
};

export const getCandidates = unstable_cache(
  async (): Promise<CachedCandidate[]> => {
    const rows = await prisma.candidate.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        source: true,
        createdAt: true,
        metadata: true,
      },
    });
    return rows.map((c) => {
      const meta = movieMeta(c.metadata);
      return {
        id: c.id,
        title: c.title,
        source: c.source,
        createdAt: c.createdAt.toISOString(),
        posterUrl: meta.posterUrl,
        trailerUrl: meta.trailerUrl,
        offers: capOffers(meta.offers),
      };
    });
  },
  ["candidates"],
  { tags: [TAG_CANDIDATES], revalidate: 60 },
);

// ---------------------------------------------------------------------------
// Current week's locked screening (/choose, home)
// ---------------------------------------------------------------------------

export type CachedLockedScreening = {
  id: string;
  movieTitle: string;
  weekNumber: number;
  selectionMethod: string;
  selectedByName: string | null;
  posterUrl: string | null;
  trailerUrl: string | null;
  offers: Offer[];
} | null;

export const getLockedScreening = unstable_cache(
  async (year: number, weekNumber: number): Promise<CachedLockedScreening> => {
    const s = await prisma.screening.findUnique({
      where: { year_weekNumber: { year, weekNumber } },
      select: {
        id: true,
        movieTitle: true,
        weekNumber: true,
        selectionMethod: true,
        selectedBy: { select: { name: true } },
        metadata: true,
      },
    });
    if (!s) return null;
    const meta = movieMeta(s.metadata);
    return {
      id: s.id,
      movieTitle: s.movieTitle,
      weekNumber: s.weekNumber,
      selectionMethod: s.selectionMethod,
      selectedByName: s.selectedBy?.name ?? null,
      posterUrl: meta.posterUrl,
      trailerUrl: meta.trailerUrl,
      offers: capOffers(meta.offers),
    };
  },
  ["locked-screening"],
  { tags: [TAG_SELECTION], revalidate: 60 },
);

// ---------------------------------------------------------------------------
// Archive screenings with aggregate ratings (shared stats, cached). Per-user
// `myRating` is resolved by the caller so it is never baked into the cache.
// ---------------------------------------------------------------------------

export type CachedScreeningStats = {
  id: string;
  year: number;
  weekNumber: number;
  weekStart: string | null;
  movieTitle: string;
  watchOnVC: boolean;
  posterUrl: string | null;
  trailerUrl: string | null;
  offers: Offer[];
  actors: string[];
  directors: string[];
  averageRating: number | null;
  ratingCount: number;
};

export type CachedArchive = {
  screenings: CachedScreeningStats[];
  ratingsByScreening: Record<string, { average: number | null; count: number }>;
};

export const getArchive = unstable_cache(
  async (): Promise<CachedArchive> => {
    const screenings = await prisma.screening.findMany({
      orderBy: [{ year: "desc" }, { weekNumber: "desc" }],
      select: {
        id: true,
        year: true,
        weekNumber: true,
        weekStart: true,
        movieTitle: true,
        watchOnVC: true,
        metadata: true,
        ratings: { select: { value: true, userId: true } },
      },
    });

    const view: CachedScreeningStats[] = [];
    const ratingsByScreening: CachedArchive["ratingsByScreening"] = {};
    for (const s of screenings) {
      const values = s.ratings.map((r) => r.value);
      const count = values.length;
      const average = count > 0 ? values.reduce((a, b) => a + b, 0) / count : null;
      const meta = movieMeta(s.metadata);
      view.push({
        id: s.id,
        year: s.year,
        weekNumber: s.weekNumber,
        weekStart: s.watchOnVC && s.weekStart ? s.weekStart.toISOString() : null,
        movieTitle: s.movieTitle,
        watchOnVC: s.watchOnVC,
        posterUrl: meta.posterUrl,
        trailerUrl: meta.trailerUrl,
        offers: capOffers(meta.offers),
        actors: meta.actors,
        directors: meta.directors,
        averageRating: average === null ? null : Math.round(average * 100) / 100,
        ratingCount: count,
      });
      ratingsByScreening[s.id] = {
        average: average === null ? null : Math.round(average * 100) / 100,
        count,
      };
    }
    return { screenings: view, ratingsByScreening };
  },
  ["archive"],
  { tags: [TAG_ARCHIVE], revalidate: 60 },
);

// Convenience for the current week's locked screening in callers that already
// computed `currentWeek()`.
export async function getCurrentLockedScreening() {
  const week = currentWeek();
  return getLockedScreening(week.year, week.weekNumber);
}
