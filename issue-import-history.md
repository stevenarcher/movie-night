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

---

## Follow-up: `watchOnVC` flag + corrected import

The original import treated **every** titled row as a weekly `Screening`, ignoring the `Watched`
column. Films that were never the featured weekly pick got imported as weekly picks. Fixed:

### Schema (`prisma/schema.prisma`)

- `Screening.watchOnVC Boolean @default(true)` — `true` = weekly VC pick; `false` = non-VC film.
- `Screening.weekStart` made **nullable** — non-VC films have no recorded watch date.
- Migration: `prisma/migrations/20260903000000_add_screening_watch_on_vc/`.

### Import (`scripts/import-history.ts`)

- Reads the `Watched` column (index 3 in every tab): `TRUE` → `watchOnVC: true` (real week/date,
  numbered as before); `FALSE`/empty → `watchOnVC: false`.
- Non-VC films share the `Screening` table but get a **synthetic week number** starting at
  `10_000` so the `(year, weekNumber)` unique key never collides and ordering stays stable; the
  UI hides the number for non-VC. `weekStart` is left `null`.
- **Deletes all 2020–2025 screenings first**, then re-imports cleanly. 2026 live spin data and
  all ratings are untouched.

### Archive UI

- `ArchiveClient` gains a **"Show all films"** toggle (default off). Off → only `watchOnVC: true`
  (weekly picks). On → reveals non-VC films.
- Non-VC films render with a **year-only** badge (no `· W{n}`) and no "Watched" line.
- `ScreeningView`/API carry `watchOnVC`; `weekStart` is `string | null`.
- Rankings (`/archive` `computeRankings` + `api/ratings/rankings/route.ts`) exclude non-VC films.

### Data

| Year | VC | Non-VC |
|------|----|--------|
| 2020 | 38 | 2 |
| 2021 | 62 | 17 |
| 2022 | 48 | 15 |
| 2023 | 48 | 11 |
| 2024 | 42 | 52 |
| 2025 | 38 | 43 |
| 2026 | 45 | 0 |

Total 416 (276 watchOnVC, 140 non-VC). `enrich-archive.ts` re-run fetches posters for non-VC
films too (4 titles had no TMDB match, e.g. "To Be Released").

### Week-number fix (2020–2024)

The spreadsheet's `Week` column runs a sequence across **all** rows (VC and non-VC alike), so
for 2020–2024 it produced gappy VC week numbers (e.g. 2024: 1, 4, 5, 6, 8, 10, …) — non-VC films
were wrongly consuming weekly slots. `import-history.ts`'s `numbered` branch now sorts VC films
by their raw week value (chronological) and renumbers them **consecutively 1..N**; non-VC films
never increment the count. 2025 is unaffected (already consecutive 1..38 via real dates).

After the re-run each year's VC weeks are consecutive 1..N:

| Year | VC weeks |
|------|----------|
| 2020 | 1..38 |
| 2021 | 1..62 |
| 2022 | 1..48 |
| 2023 | 1..48 |
| 2024 | 1..42 |
| 2025 | 1..38 |
| 2026 | 1..27 |

Non-VC films keep synthetic 10000+ week numbers (max 10052), never shown in the UI.

### 2026 wrong-date fix

All 45 of the 2026 rows originally came from `scripts/seed-archive.ts`, which fabricated
`weekStart` as consecutive Mondays from 5 Jan 2026 (`5 Jan + (week − 1) × 7 days`). Real watch
dates are irregular, so **every 2026 date was wrong** (e.g. "Deathstalker" showed 09 Nov 2026
instead of 28 Aug 2026), and the seed flagged **all** rows as `watchOnVC: true` even though the
sheet marks many as non-VC.

`import-history.ts` now imports 2026 from the spreadsheet's `2026` tab:
- The tab has a different layout — **`Watched on VC` at column 1** (2020–2025 use column 3) and
  `Date` at column 11 — so the per-year config gained a `watchedCol` and fetches named tabs via
  the `sheet=` GViz URL instead of `gid`.
- VC picks (`Watched on VC = TRUE`) use the real `Date` column, renumbered consecutively 1..N.
- Non-VC films get `watchOnVC: false` (synthetic weeks, year-only in the UI).
- The wipe step now also covers 2026.

Result: 2026 = **27 VC** (real dates, weeks 1..27; Deathstalker → 2026-08-28) + **49 non-VC**.
`scripts/seed-archive.ts` was **removed** — it was an orphaned dev utility (nothing referenced
it) whose fabricated dates caused this bug; `import-history.ts` is the single source of truth.

Totals after all re-imports: 492 (303 watchOnVC, 189 non-VC). Ratings remain untouched.