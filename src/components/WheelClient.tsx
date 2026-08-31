"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Wheel, type WheelHandle } from "@/components/Wheel";
import type { Offer } from "@/lib/movie-meta";

type Winner = {
  movieTitle: string;
  weekNumber: number;
  posterUrl: string | null;
  trailerUrl: string | null;
  offers: Offer[];
};

type Candidate = { title: string; posterUrl: string | null };

export function WheelClient({ candidates }: { candidates: Candidate[] }) {
  const wheelRef = useRef<WheelHandle>(null);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readyToSpin = candidates.length >= 2 && !spinning && !winner;

  const fireConfetti = useCallback(async () => {
    const confetti = (await import("canvas-confetti")).default;
    confetti({ particleCount: 200, spread: 75, origin: { y: 0.62 }, scalar: 1.1 });
    confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 } });
    confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 } });
  }, []);

  async function spin() {
    if (!readyToSpin) return;
    setError(null);

    let screening: Winner;
    try {
      const res = await fetch("/api/select", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "The server said no — try again.");
        return;
      }
      screening = data.screening;
    } catch {
      setError("Could not reach the server. Try again.");
      return;
    }

    // Find the picked movie's position so the wheel lands exactly on it.
    let index = candidates.findIndex(
      (c) => c.title.toLowerCase() === screening.movieTitle.toLowerCase(),
    );
    if (index < 0) index = Math.floor(Math.random() * candidates.length);

    setSpinning(true);
    await wheelRef.current?.spinTo(index);
    setSpinning(false);
    setWinner(screening);
    void fireConfetti();
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <Wheel ref={wheelRef} segments={candidates} />

      {error ? (
        <p className="max-w-md rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-center text-sm text-foreground">
          {error}
        </p>
      ) : candidates.length === 0 ? (
        <p className="rounded-xl border border-edge bg-panel px-5 py-3 text-sm text-muted">
          The pool is empty — add movies before the wheel can pick one.
        </p>
      ) : candidates.length === 1 ? (
        <p className="rounded-xl border border-edge bg-panel px-5 py-3 text-sm text-muted">
          Need at least two movies for a fair spin. Add one more.
        </p>
      ) : null}

      <button
        type="button"
        onClick={spin}
        disabled={!readyToSpin}
        className="rounded-full bg-accent px-12 py-4 text-sm font-medium uppercase tracking-[0.2em] text-background shadow-[0_0_40px_rgba(2,223,130,0.35)] transition-all hover:bg-accent-2 hover:shadow-[0_0_55px_rgba(2,223,130,0.5)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        {spinning ? "Spinning" : "Spin the wheel"}
      </button>

      {winner && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
            {winner.posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={winner.posterUrl}
                alt={`${winner.movieTitle} poster`}
                className="h-56 w-full border-b border-edge object-cover"
              />
            )}
            <div className="p-8 text-center">
              <div className="slate">
                <span className="sc">TAKE 01</span>
                <span className="nm">locked</span>
              </div>
              <p className="eyebrow mt-4">Week {winner.weekNumber} — picture locked</p>
              <h2 className="font-display mt-3 text-4xl leading-tight">{winner.movieTitle}</h2>
              <p className="mt-3 text-sm text-muted">The wheel moves on for next week.</p>

              {winner.trailerUrl && (
                <a
                  href={winner.trailerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-edge px-4 py-1.5 text-[11px] uppercase tracking-[0.12em] text-foreground transition-colors hover:border-accent/60 hover:text-accent"
                >
                  ▶ Watch trailer
                </a>
              )}

              {winner.offers.length > 0 && (
                <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                  {winner.offers.map((o) => (
                    <a
                      key={`${o.provider}-${o.type}-${o.url}`}
                      href={o.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-edge px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-foreground transition-colors hover:border-accent/60 hover:text-accent"
                    >
                      {o.provider} · {o.type.toLowerCase()}
                    </a>
                  ))}
                </div>
              )}

              <div className="mt-8 flex justify-center gap-3">
                <Link
                  href="/archive"
                  className="rounded-full bg-accent px-6 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-background hover:bg-accent-2 transition-colors"
                >
                  Rate it in the archive
                </Link>
                <button
                  type="button"
                  onClick={() => setWinner(null)}
                  className="rounded-full border border-edge px-6 py-3 text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-accent/60 hover:text-accent"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}