/** Shared TMDB lookup helpers used by the import/enrichment pipeline and live ingest. */

const IMG_URL = (path: string) => `https://image.tmdb.org/t/p/w500${path}`;

/** Reads lazily so scripts that call loadEnvFile() before use still pick the token up. */
const token = () => process.env.TMDB_READ_TOKEN;

type SearchResult = {
  id: number;
  title: string;
  release_date: string | null;
  poster_path: string | null;
};

/** Query overrides for titles TMDB spells differently (incl. dirty spreadsheet entries). */
const QUERY_OVERRIDES: Record<string, string> = {
  "Luc Besson's Dracula": "Dracula: A Love Tale",
  "Greenland Migration": "Greenland: Migration",
  "Sisu Road to Revenge": "Sisu: Road to Revenge",
  "💰  Barb & Star Go to Vista Del Mar": "Barb & Star Go to Vista Del Mar",
  "💰 Black Widow": "Black Widow",
  Boderlands: "Borderlands",
  "Beverley Hills Cop": "Beverly Hills Cop",
  Maxxine: "MaXXXine",
  "Five Nights at Freddie's": "Five Nights at Freddy's",
};

async function tmdbSearch(query: string): Promise<SearchResult[]> {
  const TOKEN = token();
  if (!TOKEN) return [];
  const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(
    query,
  )}&include_adult=true&language=en-US&page=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`search failed (${res.status}) for "${query}"`);
  const data = (await res.json()) as { results: SearchResult[] };
  return data.results;
}

async function tmdbDetails(id: number) {
  const TOKEN = token();
  if (!TOKEN) return null;
  const url = `https://api.themoviedb.org/3/movie/${id}?append_to_response=videos&language=en-US`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`details failed (${res.status}) for id ${id}`);
  return res.json();
}

/** Prefer a result with a poster, favouring the kind of release era other results cluster in. */
function bestMatch(results: SearchResult[]): SearchResult | null {
  const withPoster = results.filter((r) => r.poster_path);
  if (withPoster.length === 0) return null;
  return withPoster[0];
}

function pickTrailer(details: {
  videos?: { results?: Array<{ site?: string; type?: string; official?: boolean; key?: string }> };
}): string | null {
  const videos = details.videos?.results ?? [];
  const youtube = videos.filter((v) => v.site === "YouTube" && v.type === "Trailer" && v.key);
  const official = youtube.find((v) => v.official) ?? youtube[0];
  return official?.key ? `https://www.youtube.com/watch?v=${official.key}` : null;
}

export async function tmdbMeta(title: string): Promise<{
  posterUrl: string | null;
  trailerUrl: string | null;
  matchedTitle: string | null;
  matchedYear: string | null;
}> {
  const query = QUERY_OVERRIDES[title] ?? title;
  const match = bestMatch(await tmdbSearch(query));
  if (!match || !match.poster_path) {
    return { posterUrl: null, trailerUrl: null, matchedTitle: null, matchedYear: null };
  }
  const details = (await tmdbDetails(match.id)) as {
    videos?: { results?: Array<{ site?: string; type?: string; official?: boolean; key?: string }> };
  };
  return {
    posterUrl: IMG_URL(match.poster_path),
    trailerUrl: details ? pickTrailer(details) : null,
    matchedTitle: match.title,
    matchedYear: match.release_date?.slice(0, 4) ?? null,
  };
}

/** Best-effort poster lookup; never throws. Returns null if TMDB can't provide one. */
export async function tmdbPoster(title: string): Promise<string | null> {
  try {
    return (await tmdbMeta(title)).posterUrl;
  } catch {
    return null;
  }
}