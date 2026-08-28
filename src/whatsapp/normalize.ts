/**
 * Normalizes a raw title so that equivalent spellings of the same movie
 * collapse to one canonical key used for deduplication.
 */
export function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\u2018\u2019\u00b4\u0060]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}