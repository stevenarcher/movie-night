"use client";

import { useState } from "react";
import { StarRating } from "@/components/StarRating";

export type ScreeningView = {
  id: string;
  weekNumber: number;
  weekStart: string;
  movieTitle: string;
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
            <RankingCard title="🏆 Top picks" rows={top} />
          )}
          {bottom.length > 0 && (
            <RankingCard title="🍿 Bottom of the heap" rows={bottom} />
          )}
        </section>
      )}

      {screenings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-edge bg-panel-2 p-10 text-center text-muted">
          <p className="text-3xl">🎞️</p>
          <p className="mt-2">No movies have been selected yet.</p>
          <p className="text-sm">Spin the wheel to make your first pick.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {screenings.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-3 rounded-2xl border border-edge bg-panel p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-accent/15 px-2 py-0.5 font-mono text-xs font-semibold text-accent">
                    W{s.weekNumber}
                  </span>
                  <h2 className="truncate text-lg font-bold">{s.movieTitle}</h2>
                </div>
                <div className="mt-1.5 flex items-center gap-3 pl-1 text-sm text-muted">
                  <StarRating displayValue={s.averageRating} />
                  <span>
                    {s.averageRating === null ? "No ratings yet" : `${s.averageRating.toFixed(1)}`}{" "}
                    · {s.ratingCount} rating{s.ratingCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pl-1 sm:flex-col sm:items-end sm:gap-1">
                <StarRating value={s.myRating ?? 0} onChange={(v) => rate(s.id, v)} interactive />
                <p className="text-xs text-muted">
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
    <div className="rounded-2xl border border-edge bg-panel p-5">
      <h2 className="font-semibold">{title}</h2>
      <ol className="mt-3 flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center justify-between text-sm">
            <span className="min-w-0 truncate">
              <span className="mr-2 font-mono text-xs text-muted">{i + 1}.</span>
              {r.name}
            </span>
            <span className="ml-3 shrink-0 font-medium text-amber-400">{r.average.toFixed(1)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}