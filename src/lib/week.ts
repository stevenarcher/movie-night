/** Week math used to derive the "weekly movie" slot. */

const MS_PER_DAY = 86_400_000;

export function startOfWeek(date: Date = new Date()): Date {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (new Date(utc).getUTCDay() + 6) % 7; // Monday = 0
  return new Date(utc - day * MS_PER_DAY);
}

/**
 * ISO-8601 week-year and week number for a date: the week that contains the
 * first Thursday of a year (equivalently, the week containing Jan 4) is week 1.
 * Returns the ISO year, which may differ from getFullYear() around New Year.
 */
export function isoWeek(date: Date = new Date()): { year: number; weekNumber: number } {
  const monday = startOfWeek(date);
  // Thursday of the same week (used to determine which year the week belongs to).
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Monday = startOfWeek(jan4);
  const weekNumber = Math.floor((monday.getTime() - jan4Monday.getTime()) / (7 * MS_PER_DAY)) + 1;
  return { year: isoYear, weekNumber };
}

export function weekNumberFor(date: Date = new Date()): number {
  return isoWeek(date).weekNumber;
}

export function weekYearFor(date: Date = new Date()): number {
  return isoWeek(date).year;
}

export function currentWeek(): { year: number; weekNumber: number; weekStart: Date } {
  const weekStart = startOfWeek();
  return { year: weekYearFor(weekStart), weekNumber: weekNumberFor(weekStart), weekStart };
}