import { describe, expect, it } from "vitest";
import { cheapestRental, watchLabel, movieMeta, type Offer } from "./movie-meta";

const offer = (type: Offer["type"], price: number | null = null): Offer => ({
  type,
  provider: "Apple TV",
  price,
  url: "https://themoviedb.org/watch",
});

describe("cheapestRental", () => {
  it("returns 0 when a stream or free offer exists", () => {
    expect(cheapestRental([offer("RENT", 4.99), offer("STREAM")])).toBe(0);
    expect(cheapestRental([offer("RENT", 4.99), offer("FREE")])).toBe(0);
  });

  it("returns the lowest numeric rental price", () => {
    expect(cheapestRental([offer("RENT", 4.99), offer("RENT", 3.49), offer("BUY", 9.99)])).toBe(3.49);
  });

  it("returns null when no stream and no rental price is known", () => {
    expect(cheapestRental([offer("RENT"), offer("BUY", 7.99)])).toBeNull();
    expect(cheapestRental([])).toBeNull();
  });
});

describe("watchLabel", () => {
  it("labels a free stream as so", () => {
    expect(watchLabel([offer("STREAM")])).toBe("Free to stream");
  });

  it("labels a priced rental with a formatted price", () => {
    expect(watchLabel([offer("RENT", 3.5), offer("BUY", 9.99)])).toBe("£3.50 rental");
    expect(watchLabel([offer("RENT", 0)])).toBe("Free to stream");
  });

  it("falls back to a plain to-rent label when the price is unknown", () => {
    expect(watchLabel([offer("RENT"), offer("BUY")])).toBe("To rent");
  });

  it("falls back to a to-buy label when only buy offers have no price", () => {
    expect(watchLabel([offer("BUY")])).toBe("To buy");
  });

  it("returns null when there are no offers", () => {
    expect(watchLabel([])).toBeNull();
  });
});

describe("movieMeta", () => {
  it("keeps only recognised offer types, defaulting to STREAM", () => {
    const meta = movieMeta({ offers: [{ type: "WHATEVER", provider: "X", price: 1.99, url: "u" }] });
    expect(meta.offers).toEqual([
      { type: "STREAM", provider: "X", price: 1.99, url: "u" },
    ]);
  });

  it("ignores malformed metadata", () => {
    expect(movieMeta(null)).toEqual({ posterUrl: null, trailerUrl: null, offers: [] });
    expect(movieMeta({ offers: "nope" }).offers).toEqual([]);
    expect(movieMeta({ posterUrl: 42, trailerUrl: undefined }).offers).toEqual([]);
  });
});