export type Offer = {
  type: "RENT" | "BUY" | "STREAM" | "FREE";
  provider: string;
  price: number | null;
  url: string;
};

export type MovieMeta = {
  posterUrl: string | null;
  trailerUrl: string | null;
  offers: Offer[];
  actors: string[];
  directors: string[];
};

const OFFER_TYPES = ["RENT", "BUY", "STREAM", "FREE"] as const;

/** Normalises an array-ish field: keeps trimmed non-empty strings, deduped. */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names = value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((n) => n.length > 0);
  return names.filter((n, i) => names.indexOf(n) === i);
}

/**
 * Normalises the free-form `metadata` JSON that both Candidates (pool) and
 * Screenings (weekly picks) may carry: a poster URL, a YouTube trailer URL, an
 * array of "where to watch" offers, the main acting cast, and the director(s).
 * Unknown/absent fields fall back to safe defaults so every consumer renders
 * consistently.
 */
export function movieMeta(metadata: unknown): MovieMeta {
  const m = (metadata ?? {}) as {
    posterUrl?: unknown;
    trailerUrl?: unknown;
    offers?: unknown;
    actors?: unknown;
    directors?: unknown;
  };
  const rawOffers = Array.isArray(m.offers) ? m.offers : [];
  const offers: Offer[] = rawOffers.map((o) => {
    const offer = (o ?? {}) as {
      type?: string;
      provider?: string;
      price?: number | null;
      url?: string;
    };
    const t = (OFFER_TYPES as readonly string[]).includes(offer.type ?? "")
      ? (offer.type as Offer["type"])
      : "STREAM";
    return {
      type: t,
      provider: offer.provider ?? "",
      price: typeof offer.price === "number" ? offer.price : null,
      url: offer.url ?? "",
    };
  });
  return {
    posterUrl: typeof m.posterUrl === "string" && m.posterUrl ? m.posterUrl : null,
    trailerUrl: typeof m.trailerUrl === "string" && m.trailerUrl ? m.trailerUrl : null,
    offers,
    actors: stringList(m.actors),
    directors: stringList(m.directors),
  };
}

/**
 * Cheapest way to watch: a stream/free offer wins at £0, otherwise the lowest
 * rental price. Returns null when no numeric price is known.
 */
export function cheapestRental(offers: Offer[]): number | null {
  if (offers.some((o) => o.type === "STREAM" || o.type === "FREE")) return 0;
  const rents = offers.filter((o) => o.type === "RENT" && o.price != null);
  if (rents.length === 0) return null;
  return Math.min(...rents.map((o) => o.price!));
}

/**
 * Human-readable badge for how a film can be watched. Falls back to a plain
 * "to rent"/"to buy" label when the offers carry no numeric price (TMDB's
 * watch-providers data is price-less).
 */
export function watchLabel(offers: Offer[]): string | null {
  if (offers.some((o) => o.type === "STREAM" || o.type === "FREE")) return "Free to stream";
  const price = cheapestRental(offers);
  if (price !== null) return price === 0 ? "Free to stream" : `£${price.toFixed(2)} rental`;
  if (offers.some((o) => o.type === "RENT")) return "To rent";
  if (offers.some((o) => o.type === "BUY")) return "To buy";
  return null;
}
