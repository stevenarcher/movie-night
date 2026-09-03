# Import previous years' films (2020–2025) and add year navigation to the archive

## Status

Implemented. The code/data changes described below have been made and verified. This file documents the work for tracking.

## Summary

The weekly archive only contained 2026 films. The group's full history lives in the
[Virtual Cinema spreadsheet](https://docs.google.com/spreadsheets/d/1F56l_YGbB_Xo3xBHa68z45IQj6Rkdf1ZlqnkfrfPY68)
across year tabs (`2026` … `2020`). This change:

1. Imports all prior-year (2020–2025) films into the DB as archive `Screening`s (film + week + date).
2. Lets users view past years on the `/archive` page via a year selector.

## What changed

### Schema

- `prisma/schema.prisma`: `Screening` now has a `year Int` column; the unique key changed from the
  global `weekNumber` to the composite `@@unique([year, weekNumber])` (week numbers restart 1..N
  within each year).
- Migration: `prisma/migrations/20260902090000_add_screening_year/` (backfills existing 2026 rows
  to `year = 2026`).

### Code

- `src/lib/week.ts`: now returns `{ year, weekNumber }` via ISO-8601 week math (past years get
  positive week numbers).
- `src/app/api/select/route.ts`: `POST`/`DELETE` create/match a Screening on `(year, weekNumber)`
  and set `year`; `P2002` conflict handling uses the composite key.
- `src/app/page.tsx`, `src/app/wheel/page.tsx`: current-week lookups use the composite key.
- `src/app/api/archive/route.ts`: selects and returns `year`; orders by `(year desc, weekNumber desc)`.
- `src/app/archive/page.tsx`: carries `year` into the views.
- `src/components/ArchiveClient.tsx`: `ScreeningView` gained `year`; added a year selector; groups
  the list by the selected year (default current); the week badge reads `{year} · W{n}`; a
  "Watched <date>" line shows for 2025+ (the only years with real recorded dates).
- `scripts/seed-archive.ts`: sets `year: 2026` on seeded screenings.

### New script

- `scripts/import-history.ts`: fetches each prior-year tab CSV from the spreadsheet by `gid`, parses
  the film / week / date columns (uses real `DD/MM/YYYY` dates for 2025; derives an anchored Monday
  for earlier years that have no date column), and upserts `Screening` rows. Run:
  `node --experimental-strip-types scripts/import-history.ts` (requires Postgres via `pnpm db:up`).

## Data imported

| Year | Screenings |
|------|-----------|
| 2020 | 40 |
| 2021 | 79 |
| 2022 | 63 |
| 2023 | 59 |
| 2024 | 67 |
| 2025 | 40 |
| 2026 | 45 (pre-existing) |

Notes:

- Per the agreed scope, **ratings were not imported** — `Rating` needs a real `userId` and the
  spreadsheet columns (Charlie, Dip, Kev, Wan, Jasper, Cate, Steven, Phil, Wayne) cannot be mapped
  to app accounts except possibly the user's own. Earlier year tabs also store ratings as free-form
  text / emoji stars; those were ignored. Users can add their own ratings via the existing UI.
- 2025 films with the real `Watched` date column are numbered 1..N by date. Earlier years use their
  recorded week column (1..N). Years without a date column show no "Watched" date in the UI.
- Posters/trailers/offers are not attached to prior-year entries. Run `scripts/enrich-archive.ts`
  (TMDB) across all screenings to fill these in.

## Verification

- `pnpm lint` — clean
- `pnpm typecheck` — clean
- `pnpm test` — 22 passed
- `pnpm build` — clean
- `/archive` smoke test returns 200 and renders the year selector (2020–2026) with 2026 default.