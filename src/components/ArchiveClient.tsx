"use client";

import { useState } from "react";
import { StarRating } from "@/components/StarRating";
import type { Offer } from "@/lib/movie-meta";

export type ScreeningView = {
  id: string;
  weekNumber: number;
  weekStart: string;
  movieTitle: string;
  posterUrl: string | null;
  trailerUrl: string | null;
  offers: Offer[];
  averageRating: number | null;
  ratingCount: number;
  myRating: number | null;
};

export type RankingView = {
  name: string;
  average: number;
  count: number;
};

type Props = {
  initialScreenings: ScreeningView[];
  rankings: { top: RankingView[]; bottom: RankingView[] };
};

export function ArchiveClient({ initialScreenings, rankings }: Props) {
  const [screenings, setScreenings] = useState(initialScreenings);
  const [top, setTop] = useState(rankings.top);
  const [bottom, setBottom] = useState(rankings.bottom);
  const [saving, setSaving] = useState<string | null>(null);

  async function refresh() {
    const [archiveRes, rankingRes] = await Promise.all([
      fetch("/api/archive"),
      fetch("/api/ratings/rankings"),
    ]);
    if (archiveRes.ok) {
      const data = await archiveRes.json();
      setScreenings(data.screenings);
    }
    if (rankingRes.ok) {
      const data = await rankingRes.json();
      setTop(data.top);
      setBottom(data.bottom);
    }
  }

  async function rate(screeningId: string, value: number) {
    setSaving(screeningId);
    setScreenings((prev) =>
      prev.map((s) =>
        s.id === screeningId
          ? { ...s, myRating: value, averageRating: adjustAverage(s, value) }
          : s,
      ),
    );
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screeningId, value }),
      });
      if (!res.ok) return;
      await refresh();
    } finally {
      setSaving(null);
    }
  }

  // Local, optimistic estimate of the new average after changing my rating.
  function adjustAverage(s: ScreeningView, newValue: number): number | null {
    const old = s.myRating;
    const count = s.ratingCount;
    if (count === 0) return newValue;
    if (s.averageRating === null) return newValue;
    const total = s.averageRating * count;
    return Math.round(((total + (old === null ? newValue : newValue - old)) / count) * 100) / 100;
  }

  return (
    <div className="flex flex-col gap-10">
      {(top.length > 0 || bottom.length > 0) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {top.length > 0 && (
            <RankingCard title="Top picks" rows={top} />
          )}
          {bottom.length > 0 && (
            <RankingCard title="Bottom of the heap" rows={bottom} />
          )}
        </section>
      )}

      {screenings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge bg-panel-2 p-14 text-center text-muted">
          <p className="font-display text-3xl italic">The reel is empty</p>
          <p className="mt-2 text-sm">No movies have been selected yet.</p>
          <p className="text-sm">Spin the wheel to make your first pick.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {screenings.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-3 rounded-xl border border-edge bg-panel p-4 sm:flex-row sm:items-start sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 gap-4">
                {s.posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.posterUrl}
                    alt={`${s.movieTitle} poster`}
                    loading="lazy"
                    className="h-[110px] w-[74px] shrink-0 self-start rounded-md border border-edge object-cover"
                  />
                )}

                <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="rounded-md border border-accent/40 px-2 py-0.5 font-mono text-xs tracking-widest text-accent">
                    W{s.weekNumber}
                  </span>
                  <h2 className="font-display truncate text-xl">{s.movieTitle}</h2>
                </div>

                {s.trailerUrl && (
                  <a
                    href={s.trailerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 rounded-full border border-edge px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-foreground transition-colors hover:border-accent/60 hover:text-accent"
                  >
                    ▶ Trailer
                  </a>
                )}

                {s.offers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.offers.map((o) => (
                      <a
                        key={`${o.provider}-${o.type}-${o.url}`}
                        href={o.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-edge px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-foreground transition-colors hover:border-accent/60 hover:text-accent"
                      >
                        {o.provider} · {o.type.toLowerCase()}
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex items-center gap-3 pl-1 text-sm text-muted">
                  <StarRating displayValue={s.averageRating} />
                  <span>
                    {s.averageRating === null ? "No ratings yet" : `${s.averageRating.toFixed(1)}`}{" "}
                    · {s.ratingCount} rating{s.ratingCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              </div>

              <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                <StarRating
                  key={s.myRating ?? 0}
                  value={s.myRating ?? 0}
                  onSubmit={(v) => rate(s.id, v)}
                  pending={saving === s.id}
                  interactive
                />
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  {saving === s.id ? "Saving…" : s.myRating ? "Your rating" : "Tap to rate"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RankingCard({ title, rows }: { title: string; rows: RankingView[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-panel">
      <div className="border-b border-edge px-5 py-4">
        <h2 className="font-display text-2xl">{title}</h2>
      </div>
      <ol className="flex flex-col gap-1 p-5 pt-4">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="min-w-0 flex items-center gap-3">
              <span className="font-mono text-xs tracking-widest text-muted">{i + 1}.</span>
              <span className="min-w-0 truncate">{r.name}</span>
            </span>
            <span className="shrink-0 font-mono text-xs tracking-widest text-accent">{r.average.toFixed(1)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}