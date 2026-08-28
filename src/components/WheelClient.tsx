"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Wheel, type WheelHandle } from "@/components/Wheel";

type Winner = { movieTitle: string; weekNumber: number };

export function WheelClient({ candidates }: { candidates: string[] }) {
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

    let screening: { movieTitle: string; weekNumber: number };
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
    let index = candidates.findIndex((t) => t.toLowerCase() === screening.movieTitle.toLowerCase());
    if (index < 0) index = Math.floor(Math.random() * candidates.length);

    setSpinning(true);
    await wheelRef.current?.spinTo(index);
    setSpinning(false);
    setWinner(screening);
    void fireConfetti();
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <Wheel ref={wheelRef} titles={candidates} />

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
        className="rounded-full bg-accent px-10 py-3.5 text-base font-bold text-white shadow-lg shadow-accent/30 transition-all hover:bg-accent/90 hover:shadow-accent/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        {spinning ? "Spinning…" : "Spin the wheel"}
      </button>

      {winner && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-edge bg-panel p-8 text-center shadow-2xl">
            <p className="text-4xl">🎉</p>
            <p className="mt-3 text-sm uppercase tracking-widest text-muted">
              Week {winner.weekNumber} — here&apos;s the movie
            </p>
            <h2 className="mt-2 text-3xl font-black">{winner.movieTitle}</h2>
            <p className="mt-2 text-sm text-muted">Locked in. The wheel moves on for next week.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/archive"
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 transition-colors"
              >
                Rate it in the archive
              </Link>
              <button
                type="button"
                onClick={() => setWinner(null)}
                className="rounded-full border border-edge px-5 py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}