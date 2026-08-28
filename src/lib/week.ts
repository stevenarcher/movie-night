/** Week math used to derive the "weekly movie" slot. */

const MS_PER_DAY = 86_400_000;

/** First Monday of 2026 — used as the epoch for week numbering. */
const WEEKS_EPOCH = Date.UTC(2026, 0, 5);

export function startOfWeek(date: Date = new Date()): Date {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (new Date(utc).getUTCDay() + 6) % 7; // Monday = 0
  return new Date(utc - day * MS_PER_DAY);
}

export function weekNumberFor(date: Date = new Date()): number {
  const start = startOfWeek(date).getTime();
  return Math.floor((start - WEEKS_EPOCH) / (7 * MS_PER_DAY)) + 1;
}

export function currentWeek(): { weekNumber: number; weekStart: Date } {
  const weekStart = startOfWeek();
  return { weekNumber: weekNumberFor(weekStart), weekStart };
}