import { z } from "zod";
import { normalizeTitle } from "./normalize";

export const MIN_TITLE_LENGTH = 2;
export const MAX_TITLE_LENGTH = 80;
/** Hard ceiling on candidates to keep the wheel and pool sane. */
export const MAX_POOL_SIZE = 200;

const TITLE_PATTERN = /^[\p{L}\p{N}\s'’\-.:,!?&()[\]%]+$/u;
const URL_PATTERN = /(https?:\/\/|www\.|t\.co\/)/i;
const AT_MENTION = /@\w+/;
const REPEATED_CHAR = /(.)\1{4,}/;
const EMOJI_PATTERN = /[\p{Extended_Pictographic}]/u;

/** Short filler words/commands that are never a movie title. */
const FILLER = new Set([
  "ok",
  "okay",
  "lol",
  "lmao",
  "haha",
  "hehe",
  "hmm",
  "hmmm",
  "yes",
  "no",
  "nah",
  "maybe",
  "top",
  "the",
  "a",
  "an",
  "watch",
  "watching",
  "watched",
  "movie",
  "movies",
  "film",
  "films",
  "tonight",
  "friday",
  "spin",
  "spinning",
  "random",
  "anything",
  "whatever",
  "cool",
  "nice",
  "later",
  "sure",
  "done",
  "next",
  "same",
  "pick",
  "pick one",
]);

export interface ValidatedTitle {
  ok: true;
  title: string;
  normalizedTitle: string;
}

export interface InvalidTitle {
  ok: false;
  reason: string;
}

export type TitleValidation = ValidatedTitle | InvalidTitle;

export const movieTitleSchema = z
  .string()
  .trim()
  .min(MIN_TITLE_LENGTH)
  .max(MAX_TITLE_LENGTH)
  .regex(TITLE_PATTERN);

/** Validate a raw suggestion and, if valid, return its dedupe key. */
export function validateTitle(input: string): TitleValidation {
  const trimmed = input.replace(/\s+/g, " ").trim();

  if (trimmed.length < MIN_TITLE_LENGTH) {
    return { ok: false, reason: "Too short to be a movie title." };
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return { ok: false, reason: `Longer than ${MAX_TITLE_LENGTH} characters.` };
  }
  if (URL_PATTERN.test(trimmed)) {
    return { ok: false, reason: "Message contains a URL." };
  }
  if (AT_MENTION.test(trimmed)) {
    return { ok: false, reason: "Message mentions another user." };
  }
  if (EMOJI_PATTERN.test(trimmed)) {
    return { ok: false, reason: "Message contains emoji." };
  }
  if (REPEATED_CHAR.test(trimmed)) {
    return { ok: false, reason: "Message looks like spam." };
  }

  const parsed = movieTitleSchema.safeParse(trimmed);
  if (!parsed.success) {
    return { ok: false, reason: "Message contains unsupported characters." };
  }

  const letters = trimmed.match(/[^\s]/g) ?? [];
  const upper = trimmed.match(/\p{Lu}/gu) ?? [];
  if (trimmed.length >= 12 && upper.length / Math.max(letters.length, 1) > 0.85) {
    return { ok: false, reason: "Message looks like spam (all caps)." };
  }

  const normalizedTitle = normalizeTitle(trimmed);
  if (!normalizedTitle || FILLER.has(normalizedTitle)) {
    return { ok: false, reason: "Message is not a movie suggestion." };
  }

  return { ok: true, title: trimmed, normalizedTitle };
}