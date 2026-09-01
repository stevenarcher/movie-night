# Movie Night

A social platform for one group's weekly movie pick. Friends suggest movies over WhatsApp,
a spinning wheel randomly locks in the week's screening, and everyone rates the pick in the
archive.

[![Netlify Status](https://api.netlify.com/api/v1/badges/5b281893-6145-4867-97a4-85cd5b1cb03d/deploy-status)](https://app.netlify.com/projects/rachelarcher/deploys)

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/docs)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/docs)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/docs)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/docs)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/docs)
[![WhatsApp Cloud API](https://img.shields.io/badge/WhatsApp%20Cloud%20API-25D366?style=flat-square&logo=whatsapp&logoColor=white)](https://developers.facebook.com/docs/whatsapp/cloud-api)
[![Netlify](https://img.shields.io/badge/Netlify-00C7B7?style=flat-square&logo=netlify&logoColor=white)](https://docs.netlify.com)

## How it works

The **archive, pool, and wheel are open to everyone** — you can browse them without signing in.
Actions are gated behind Google sign-in, with a prompt in place of each control: rating a movie
(archive), adding/removing movies (pool), and spinning or resetting the week (wheel).

1. **Suggest** — group members drop a movie title in the WhatsApp group. The Cloud API webhook
   ingests suggestions into the pool automatically. Movies can also be added manually on
   [/pool](http://localhost:3000/pool) (signed in).
2. **Spin** — a signed-in member opens [/wheel](http://localhost:3000/wheel) and spins. The random
   pick happens **server-side** so it's fair; the wheel animates to the chosen movie and locks it
   for the whole week (only one screening per week).
3. **Archive** — every weekly pick is recorded on [/archive](http://localhost:3000/archive) with
   the group's average rating, plus top/bottom rankings. Signed-in visitors can rate each pick.

## Stack

- **Next.js 16** (App Router, Turbopack), React 19, TypeScript
- **Tailwind CSS v4** (dark theme via CSS tokens in `globals.css`)
- **NextAuth v5 (beta)** — Google OAuth, database sessions
- **Prisma 6 + PostgreSQL** — local Postgres via Docker
- **Meta WhatsApp Cloud API** — webhook ingestion + group announcements
- **Vitest 4** — unit tests for the WhatsApp pipeline
- **canvas-confetti** — spin celebrations

## Getting started

```bash
pnpm install
pnpm db:up        # start Postgres via docker compose
pnpm db:migrate   # apply prisma migrations
cp .env.example .env   # then fill in credentials (see below)
pnpm dev
```

Other scripts: `pnpm typecheck`, `pnpm lint`, `pnpm test` (Vitest),
`pnpm build`, `pnpm db:studio`.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres DSN (`postgresql://movie:movie@localhost:5432/movie_night`) |
| `AUTH_SECRET` | NextAuth encryption secret (generate with `openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client (console.cloud.google.com) |
| `AUTH_URL` / `APP_URL` | Canonical app URL; in dev `http://localhost:3000` |
| `WA_WEBHOOK_VERIFY_TOKEN` | Arbitrary token used to verify the webhook subscription |
| `WA_APP_SECRET` | Meta app secret — signs `X-Hub-Signature-256` on webhooks |
| `WA_GROUP_ID` | The group the app listens to and announces into |
| `WA_PHONE_NUMBER_ID` | The WhatsApp business number used by the Cloud API |
| `WA_ACCESS_TOKEN` | Meta Graph API access token for sending messages |
| `WA_FROM_PHONE` | The business phone number (international format) messages are sent from |
| `TMDB_READ_TOKEN` | TMDB API v4 read token for the poster/metadata seed scripts |

**Google + WhatsApp credentials are required for production flows.** Without them the app runs
degraded: login and real webhook ingestion are disabled, but the pool, wheel, archive, ratings,
and the dev-only simulate endpoint still work.

## WhatsApp integration

The Cloud API delivers group messages as **webhooks only** — there is no way to read message
history or backfill past suggestions. The integration therefore:

- **Verifies** two ways: a `GET` challenge on subscription
  (`hub.mode` / `hub.verify_token` / `hub.challenge`) and an HMAC-SHA256
  `X-Hub-Signature-256` check on every `POST` body.
- **Filters** to text messages that carry a `group_id` (top-level or `context.group_id`),
  ignores direct 1:1 messages, and drops messages marked with delivery errors.
- **Deduplicates** on `messageId` and on a normalized title (case/punctuation-insensitive).
- **Validates** suggestions: 2–80 chars, no URLs/mentions/emoji, no all-caps spam, and a
  filler-word blocklist; the pool caps at 200 candidates.

Setup steps (Meta for Developers):

1. Create a business app and a WhatsApp client, add the group as a test participant and have a
   group admin add the business number.
2. Subscribe the webhook to the `messages` field; the verify token and URL go
   to `POST /api/whatsapp/webhook` (use a public URL — `ngrok http 3000` in dev).
3. Fill the `WA_*` env vars above.

During development, `/pool` has an "Inject test WhatsApp msg" button (shown only in dev when
signed in) that pushes a fake group message through the real ingest pipeline.

### Design notes

- **Fairness**: `/api/select` picks the winner with `Math.random` on the server inside a
  transaction. The client only animates to the returned title — it cannot influence or fake the
  result. The unique `weekNumber` constraint returns `409` if the week is already locked.
- **What happens after you spin**: the chosen candidate is removed from the pool, a `Screening`
  row records the weekly pick, and a fire-and-forget group announcement is attempted (silently
  skipped without `WA_*` config).
- **Week boundaries**: weeks start on Monday; the epoch is the first Monday of 2026
  (`src/lib/week.ts`).
- **Suggestions window**: the very first time the business number joins a group, older messages
  are not delivered; Meta archives message history for ~30 days and it cannot be replayed.
  Onboarding the group as early as possible minimises the gap.

## Module map

```
src/
├─ lib/            prisma singleton, auth (NextAuth), session helpers (currentUser/
│                  requireUser), week math, API helpers
├─ whatsapp/       types, title normalize/validate, webhook parse, signature verify,
│                  ingest (dedupe + persistence), send (visibility announcement)
├─ app/
│  ├─ page.tsx             landing page
│  ├─ wheel/page.tsx       spin the wheel (locks the week)
│  ├─ pool/page.tsx        suggestion pool (manual add/remove)
│  ├─ archive/page.tsx     weekly screenings + ratings + rankings
│  └─ api/
│     ├─ auth/[...nextauth]      NextAuth route
│     ├─ whatsapp/webhook        Cloud API webhook (GET verify / POST ingest)
│     ├─ whatsapp/simulate       dev-only fake webhook push
│     ├─ pool                    list / add candidates
│     ├─ pool/[id]               delete candidate
│     ├─ select                  server-side random weekly pick
│     ├─ archive                 screenings with ratings
│     └─ ratings                 upsert rating (+ rankings)
└─ components/     Nav, SignIn/Out, Wheel (+ client controller), PoolClient, ArchiveClient,
                   StarRating
```

## Data model (Prisma)

- `Candidate` — pool items, each with a normalized (deduped) title, source & sender info.
- `Screening` — one per week (`weekNumber` unique), stores the chosen movie and who picked it.
- `Rating` — a 1–5 value per user per screening (unique together).

See `prisma/schema.prisma` for the authoritative definitions.