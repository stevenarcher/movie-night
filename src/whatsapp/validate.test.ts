import { describe, expect, it } from "vitest";
import { validateTitle, MAX_TITLE_LENGTH } from "./validate";
import { normalizeTitle } from "./normalize";

describe("validateTitle", () => {
  it("accepts a normal movie title", () => {
    const r = validateTitle("Inception");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.normalizedTitle).toBe("inception");
    }
  });

  it("accepts titles with punctuation, numbers and ampersands", () => {
    expect(validateTitle("12 Angry Men").ok).toBe(true);
    expect(validateTitle("No Country for Old Men").ok).toBe(true);
    expect(validateTitle("Dune: Part Two").ok).toBe(true);
    expect(validateTitle("L'Auberge espagnole").ok).toBe(true);
    expect(validateTitle("Toy Story 2 & 3 (double feature)").ok).toBe(true);
  });

  it("accepts unicode letters", () => {
    expect(validateTitle("Caché").ok).toBe(true);
    expect(validateTitle("七武士").ok).toBe(true);
    expect(validateTitle("Yojimbo").ok).toBe(true);
  });

  it("rejects empty and too-short titles", () => {
    expect(validateTitle("").ok).toBe(false);
    expect(validateTitle("   ").ok).toBe(false);
    expect(validateTitle("x").ok).toBe(false);
  });

  it("rejects titles that are too long", () => {
    expect(validateTitle("A".repeat(MAX_TITLE_LENGTH + 1)).ok).toBe(false);
  });

  it("rejects URLs and mentions", () => {
    expect(validateTitle("https://example.com/trailer").ok).toBe(false);
    expect(validateTitle("check out www.example.com").ok).toBe(false);
    expect(validateTitle("see @everyone the prequel").ok).toBe(false);
  });

  it("rejects emoji and spammy repeated characters", () => {
    expect(validateTitle("Avatar 🌊").ok).toBe(false);
    expect(validateTitle("aaaaaaa").ok).toBe(false);
    expect(validateTitle("INCEPTION IS THE BEST MOVIE EVER!!!!!!").ok).toBe(false);
  });

  it("rejects all-caps shouting", () => {
    expect(validateTitle("EVERYONE MUST WATCH THE MATRIX").ok).toBe(false);
  });

  it("rejects filler words that are not movie titles", () => {
    for (const filler of ["ok", "lol", "hmm", "watch", "movie", "spin", "random", "sure"]) {
      expect(validateTitle(filler).ok).toBe(false);
    }
  });

  it("normalizes whitespace before validating", () => {
    const r = validateTitle("   Blade   Runner   2049  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.title).toBe("Blade Runner 2049");
  });
});

describe("normalizeTitle", () => {
  it("lowercases and collapses punctuation to spaces", () => {
    expect(normalizeTitle("The Godfather")).toBe("the godfather");
    expect(normalizeTitle("Dune: Part Two")).toBe("dune part two");
    expect(normalizeTitle("   Oldboy  (2003)   ")).toBe("oldboy 2003");
  });

  it("normalises curly quotes so equivalent titles dedupe", () => {
    expect(normalizeTitle("Mother’s Bosch")).toBe(normalizeTitle("Mother's Bosch"));
  });
});