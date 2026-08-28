<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Movie Night

Next.js 16 app (App Router, Turbopack default) for one group's weekly movie pick: WhatsApp
suggestions → pool → server-picked spin wheel → weekly archive with 1–5 star ratings.

## Commands

Use **pnpm** (pnpm@10.21.0). New native deps trigger pnpm build-script approval — check
`onlyBuiltDependencies` in `package.json` if installs stop building.

- `pnpm dev` — Next 16 dev server (Turbopack is default; do not pass `--turbopack`). Smoke-test
  pages against the real DB: boot requires Postgres running (`pnpm db:up`).
- `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` — full verification gate before
  wrapping up; build catches things the others miss.
- `pnpm test` — `vitest run`, colocated `src/**/*.test.ts` (see `vitest.config.ts`), Node env,
  `@/` aliased. The WhatsApp pipeline (`src/whatsapp/{normalize,validate,parse,signature}`) is
  the tested surface.
- `pnpm db:up` — starts postgres:16 via `docker-compose.yml` (creds `movie:movie`, db
  `movie_night`, port 5432). `pnpm db:migrate` = `prisma migrate dev`; `pnpm db:studio` for a
  console; `prisma generate` also runs on `postinstall`.

## Architecture invariants

- **Random pick is server-side, period.** `POST /api/select` rolls the winner in a transaction
  (`Week.weekNumber` is unique → 409 if already locked). The client wheel only animates to the
  returned title — never move the choice client-side.
- **Candidate pool is decoupled from Screening history** (`prisma/schema.prisma` comments):
  dedupe via unique `normalizedTitle` (case/punctuation-insensitive, `src/whatsapp/normalize.ts`)
  and unique `messageId`. Ratings reference Screenings only, so past picks never bias the wheel.
- Protected server pages (`/wheel`, `/pool`, `/archive`) call `requireUser()` and render
  server-side; stateful UI is a small client component fed by server-fetched props (do NOT add
  a mount `useEffect` fetch — ESLint's `react-hooks/set-state-in-effect` errors on it).
- Theme is Tailwind v4 CSS-token classes from `globals.css` `@theme`:
  `bg-panel`, `bg-panel-2`, `border-edge`, `text-muted`, `bg-accent`, `text-accent-2`,
  `bg-background`, `text-foreground`. Use tokens, not arbitrary hex.

## Prisma pin

Must stay on **Prisma 6** (`prisma@6.19.3`, `@prisma/client` 6, generator `prisma-client-js`,
datasource `url = env("DATABASE_URL")`). The Prisma 7 `prisma-client` generator breaks under
Next 16 Turbopack and conflicts with `@auth/prisma-adapter` types — do not upgrade until both
are verified. `.env` / `.env.example` hold `DATABASE_URL` + `AUTH_SECRET`.

## Auth

NextAuth v5 (**beta, database sessions**) + Google. `session.user.id` is augmented via
`src/types/next-auth.d.ts`; the sign-in callback persists `googleId`. `AUTH_GOOGLE_ID/SECRET`
are unset → login is unusable until creds are added. API routes auth with
`const s = await auth(); if (!s?.user?.id) return unauthorized();`.

## WhatsApp (Cloud API)

- The Cloud API has **no history/read API** — suggestions arrive only as webhook pushes from the
  moment the business number joins the group (~30-day archive, no backfill). Don't build
  polling/backfill.
- POST webhooks are verified with `X-Hub-Signature-256` (HMAC-SHA256, `WA_APP_SECRET`). Signatures
  are skipped when the secret is missing — dev/build only; production must set it. GET verify
  returns 200 with bare challenge only when `WA_WEBHOOK_VERIFY_TOKEN` matches, else 400.
- Group messages carry `group_id` (top-level or `context.group_id`); only text+group messages
  pass `src/whatsapp/parse.ts`. `/api/whatsapp/simulate` drives the real ingest pipeline in dev
  (it's the only unauthenticated ingest path). Edits to validation must target
  `src/whatsapp/validate.ts` and its tests; keep `MAX_POOL_SIZE` respected in ingest.