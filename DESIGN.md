# DESIGN.md — Post-Production Viewfinder

Movie Night's visual identity is adapted from the [Ghost Pitcher](https://www.ghost-pitcher.com/)
site: a private edit suite / post-production viewfinder. The app reads like a film being
assembled — a pulsing REC dot, film slates for chapter headers, timecode eyebrows, film grain
over the whole frame, and the wheel as the "picture" being locked.

## Mode

**Operate.** This is functional app UI (wheel, pool, archive, ratings), not a landing page.
Expression lives in precise details — the REC dot, the slates, the letterspaced micro-labels —
not in decorative excess. Readability and the server-flow (roll → lock → archive) stay dominant.

## Core tokens (`src/app/globals.css`)

| Token | Value | Use |
|---|---|---|
| `--color-background` (void) | `#050706` | page background |
| `--color-foreground` (bone) | `#edf1ec` | primary text |
| `--color-accent` (mint) | `#02df82` | the single accent: CTAs, active states, wheel winner, stars, week badges |
| `--color-accent-2` | `#57f5ad` | mint hover/light variant |
| `--color-muted` (dim) | `#76827a` | secondary labels |
| `--color-panel` | `#0a0e0c` | raised card surface |
| `--color-panel-2` | `#070b09` | dashed/empty-state surface |
| `--color-edge` | `rgba(237,241,236,.1)` | hairline borders |
| `--color-edge-strong` | `rgba(237,241,236,.2)` | scrollbars / hover |
| `--color-bone-dim` | `rgba(237,241,236,.55)` | tertiary text |
| `--font-sans` | **Space Grotesk** | all body / UI |
| `--font-display` | **Instrument Serif** | all headlines (`.font-display`) |
| `--font-mono` | **Geist Mono** | timecode / numbers / micro-labels |

## Signature details

- **`.grain`** — fixed film-grain overlay (CSS SVG noise, `mix-blend-mode: soft-light`), the
  Ghost Pitcher texture. Rendered once in `layout.tsx`; disabled under `prefers-reduced-motion`.
- **`.slate`** — chapter header: hairline top border with a short clapper-stripe, mint scene
  number (`TAKE 01`), bone title, dim tail (`LOCKED` / `READY TO ROLL`). Used on the status
  panel, wheel lock modal, and locked panels.
- **`.eyebrow`** / **`.eyebrow-accent`** — 11px, `0.3em` letterspacing, uppercase. Section
  kickers and page headers (`WK 01 · PICTURE START`, `CANDIDATES · AWAITING PICTURE`).
- **`.rec-dot`** — pulsing mint REC dot in the nav, echoing the site's viewfinder HUD.
- **`.vf-corner`** — viewfinder corner brackets framing the wheel.

## Conventions

- **Mint is the only accent.** No rose, amber, or blue. Interactive states shift
  accent → `accent-2`. Do not reintroduce a second accent.
- **The wheel is the one sanctioned exception.** Its wedges carry a vivid multi-hue palette
  (blue, teal, gold, orange, coral, magenta, green, mint) inspired by the spinning-wheel
  reference — the wheel is the colorful instrument/centerpiece. Mint remains the accent for its
  frame, hub, pointer, and every accent elsewhere in the app.
- Headlines are `font-display` (Instrument Serif); buttons are uppercase Space Grotesk with
  wide letterspacing (`text-[11px] uppercase tracking-[0.2em]`); micro-numbers are `font-mono`.
- Surfaces are separated by `border-edge` hairlines on `bg-panel`, not heavy shadows or fills.
- **White text on accent is never used** — accent buttons carry `text-background` (void text
  on mint), matching the site's mint-on-dark treatment.
- **Server-pick is untouched by design.** The wheel visuals animate to the server-chosen
  winner (`POST /api/select`); never move choice client-side.

## Tailwind constraints

Tokens are wired through `@theme inline`. Use them (e.g. `bg-panel`, `text-accent`,
`border-edge`, `text-muted`, `font-display`, `text-bone-dim`) and avoid arbitrary hex — add a
token instead.
