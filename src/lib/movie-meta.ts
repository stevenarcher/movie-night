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
};

const OFFER_TYPES = ["RENT", "BUY", "STREAM", "FREE"] as const;

/**
 * Normalises the free-form `metadata` JSON that both Candidates (pool) and
 * Screenings (weekly picks) may carry: a poster URL, a YouTube trailer URL, and
 * an array of "where to watch" offers. Unknown/absent fields fall back to safe
 * defaults so every consumer renders consistently.
 */
export function movieMeta(metadata: unknown): MovieMeta {
  const m = (metadata ?? {}) as { posterUrl?: unknown; trailerUrl?: unknown; offers?: unknown };
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
  };
}
