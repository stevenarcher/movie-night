"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Wheel, type WheelHandle } from "@/components/Wheel";
import { SignInPrompt } from "@/components/SignInPrompt";
import { cheapestRental, watchLabel, type Offer } from "@/lib/movie-meta";

type Winner = {
  movieTitle: string;
  weekNumber: number;
  posterUrl: string | null;
  trailerUrl: string | null;
  offers: Offer[];
};

type Candidate = { id: string; title: string; posterUrl: string | null; offers: Offer[] };

type Method = "spin" | "vote" | "pick";

const METHODS: { key: Method; label: string; description: string }[] = [
  { key: "spin", label: "Spin the wheel", description: "Random pick — let fate decide" },
  { key: "vote", label: "Vote", description: "Everyone picks their favourite, most votes wins" },
  { key: "pick", label: "Someone picks", description: "One person decides for the group" },
];

export function ChooseClient({
  signedIn,
  candidates,
}: {
  signedIn: boolean;
  candidates: Candidate[];
}) {
  const wheelRef = useRef<WheelHandle>(null);
  const [method, setMethod] = useState<Method>("vote");
  const [winner, setWinner] = useState<Winner | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vote state
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [voteCounts, setVoteCounts] = useState<Map<string, number>>(new Map());
  const [voteLoading, setVoteLoading] = useState<string | null>(null);
  const [lockLoading, setLockLoading] = useState(false);

  // Pick state
  const [pickLoading, setPickLoading] = useState<string | null>(null);

  // Fetch vote counts on mount and when switching to vote tab.
  useEffect(() => {
    if (method !== "vote") return;
    let cancelled = false;
    fetch("/api/votes")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.votes) {
          setVoteCounts(new Map(data.votes.map((v: { candidateId: string; count: number }) => [v.candidateId, v.count])));
        }
        if (data.myVotes) {
          setMyVotes(new Set(data.myVotes.map((v: { candidateId: string }) => v.candidateId)));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [method]);

  const fireConfetti = useCallback(async () => {
    const confetti = (await import("canvas-confetti")).default;
    confetti({ particleCount: 200, spread: 75, origin: { y: 0.62 }, scalar: 1.1 });
    confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 } });
    confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 } });
  }, []);

  // ── Spin ──────────────────────────────────────────────────────────────

  async function spin() {
    if (!signedIn || candidates.length < 2 || spinning || winner) return;
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

  // ── Vote ──────────────────────────────────────────────────────────────

  async function toggleVote(candidateId: string) {
    if (!signedIn || voteLoading) return;
    setVoteLoading(candidateId);
    setError(null);

    const hadVoted = myVotes.has(candidateId);
    try {
      if (hadVoted) {
        await fetch(`/api/vote?candidateId=${candidateId}`, { method: "DELETE" });
        setMyVotes((prev) => {
          const next = new Set(prev);
          next.delete(candidateId);
          return next;
        });
        setVoteCounts((prev) => {
          const next = new Map(prev);
          next.set(candidateId, Math.max(0, (next.get(candidateId) ?? 1) - 1));
          return next;
        });
      } else {
        // Remove previous vote first if any.
        for (const prevId of myVotes) {
          await fetch(`/api/vote?candidateId=${prevId}`, { method: "DELETE" });
        }
        const res = await fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Could not vote.");
          return;
        }
        setMyVotes(new Set([candidateId]));
        // Refresh counts.
        const countRes = await fetch("/api/votes");
        const countData = await countRes.json();
        if (countData.votes) {
          setVoteCounts(new Map(countData.votes.map((v: { candidateId: string; count: number }) => [v.candidateId, v.count])));
        }
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setVoteLoading(null);
    }
  }

  async function lockVote() {
    if (!signedIn || lockLoading) return;
    setLockLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "VOTE" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not lock the vote.");
        return;
      }
      setWinner(data.screening);
      void fireConfetti();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLockLoading(false);
    }
  }

  // ── Pick ──────────────────────────────────────────────────────────────

  async function manualPick(candidateId: string, title: string) {
    if (!signedIn || pickLoading) return;
    const confirmed = window.confirm(`Pick "${title}" for this week?`);
    if (!confirmed) return;

    setPickLoading(candidateId);
    setError(null);

    try {
      const res = await fetch("/api/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "MANUAL", candidateId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not pick that movie.");
        return;
      }
      setWinner(data.screening);
      void fireConfetti();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPickLoading(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  const canSpin = signedIn && candidates.length >= 2 && !spinning && !winner;
  const canVote = signedIn && !winner && candidates.length >= 2;
  const canPick = signedIn && !winner && candidates.length >= 1;

  // Compute rental prices for vote/pick tabs.
  const prices = candidates.map((c) => ({ id: c.id, price: cheapestRental(c.offers) }));
  const priced = prices.filter((p): p is { id: string; price: number } => p.price != null);
  const cheapestPrice = priced.length > 0 ? Math.min(...priced.map((p) => p.price)) : null;
  const cheapestIds = new Set(priced.filter((p) => p.price === cheapestPrice).map((p) => p.id));
  const labels = new Map(candidates.map((c) => [c.id, watchLabel(c.offers)]));

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Method tabs */}
      {!winner && (
        <div className="flex gap-2 rounded-full border border-edge bg-panel p-1">
          {METHODS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMethod(m.key)}
              className={`rounded-full px-5 py-2 text-[11px] font-medium uppercase tracking-[0.15em] transition-all ${
                method === m.key
                  ? "bg-accent text-background shadow-[0_0_20px_rgba(2,223,130,0.25)]"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Method description */}
      {!winner && (
        <p className="text-center text-sm text-muted">
          {METHODS.find((m) => m.key === method)?.description}
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="max-w-md rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-center text-sm text-foreground">
          {error}
        </p>
      )}

      {/* ── Spin tab ─────────────────────────────────────── */}
      {method === "spin" && !winner && (
        <>
          <Wheel ref={wheelRef} segments={candidates} />

          {candidates.length === 0 ? (
            <p className="rounded-xl border border-edge bg-panel px-5 py-3 text-sm text-muted">
              The pool is empty — add movies before the wheel can pick one.
            </p>
          ) : candidates.length === 1 ? (
            <p className="rounded-xl border border-edge bg-panel px-5 py-3 text-sm text-muted">
              Need at least two movies for a fair spin. Add one more.
            </p>
          ) : null}

          {signedIn ? (
            <button
              type="button"
              onClick={spin}
              disabled={!canSpin}
              className="rounded-full bg-accent px-12 py-4 text-sm font-medium uppercase tracking-[0.2em] text-background shadow-[0_0_40px_rgba(2,223,130,0.35)] transition-all hover:bg-accent-2 hover:shadow-[0_0_55px_rgba(2,223,130,0.5)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {spinning ? "Spinning" : "Spin the wheel"}
            </button>
          ) : (
            <SignInPrompt
              message="The wheel is read-only when you're signed out. Sign in to lock in this week's pick."
              label="Sign in to spin the wheel"
              callbackUrl="/choose"
            />
          )}
        </>
      )}

      {/* ── Vote tab ─────────────────────────────────────── */}
      {method === "vote" && !winner && (
        <div className="w-full max-w-lg">
          {candidates.length === 0 ? (
            <p className="rounded-xl border border-edge bg-panel px-5 py-3 text-sm text-muted">
              The pool is empty — add movies before voting.
            </p>
          ) : candidates.length === 1 ? (
            <p className="rounded-xl border border-edge bg-panel px-5 py-3 text-sm text-muted">
              Only one movie in the pool — someone should just pick it.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {candidates.map((c) => {
                const voted = myVotes.has(c.id);
                const count = voteCounts.get(c.id) ?? 0;
                const price = prices.find((p) => p.id === c.id)?.price;
                const label = labels.get(c.id) ?? null;
                const isCheapest = cheapestIds.has(c.id);
                const isExpensive = price != null && price > 5;
                return (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      voted ? "border-accent/40 bg-accent/10" : "border-edge bg-panel"
                    }`}
                  >
                    {c.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.posterUrl} alt="" className="h-10 w-7 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-7 rounded bg-panel-2" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm">{c.title}</span>
                      {label != null && (
                        <span
                          className={`mt-0.5 w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            price != null
                              ? isCheapest
                                ? "bg-accent/15 text-accent"
                                : isExpensive
                                  ? "bg-red-500/15 text-red-400"
                                  : "text-muted"
                              : "text-muted"
                          }`}
                        >
                          {label}
                        </span>
                      )}
                    </div>
                    <span className="mr-2 text-xs text-muted">{count}</span>
                    {signedIn && (
                      <button
                        type="button"
                        onClick={() => toggleVote(c.id)}
                        disabled={voteLoading === c.id}
                        className={`rounded-full px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-all ${
                          voted
                            ? "bg-accent text-background"
                            : "border border-edge text-muted hover:border-accent/60 hover:text-accent"
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {voted ? "Voted" : "Vote"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {signedIn ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={lockVote}
                disabled={!canVote || lockLoading}
                className="rounded-full bg-accent px-10 py-3 text-sm font-medium uppercase tracking-[0.2em] text-background shadow-[0_0_40px_rgba(2,223,130,0.35)] transition-all hover:bg-accent-2 hover:shadow-[0_0_55px_rgba(2,223,130,0.5)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                {lockLoading ? "Locking…" : "End voting & lock winner"}
              </button>
            </div>
          ) : (
            <div className="mt-6 flex justify-center">
              <SignInPrompt
                message="Sign in to vote on this week's movie."
                label="Sign in to vote"
                callbackUrl="/choose"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Pick tab ─────────────────────────────────────── */}
      {method === "pick" && !winner && (
        <div className="w-full max-w-lg">
          {candidates.length === 0 ? (
            <p className="rounded-xl border border-edge bg-panel px-5 py-3 text-sm text-muted">
              The pool is empty — add movies before picking.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {candidates.map((c) => {
                const price = prices.find((p) => p.id === c.id)?.price;
                const label = labels.get(c.id) ?? null;
                const isCheapest = cheapestIds.has(c.id);
                const isExpensive = price != null && price > 5;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-edge bg-panel px-4 py-3 transition-colors hover:border-accent/40"
                  >
                    {c.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.posterUrl} alt="" className="h-10 w-7 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-7 rounded bg-panel-2" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm">{c.title}</span>
                      {label != null && (
                        <span
                          className={`mt-0.5 w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            price != null
                              ? isCheapest
                                ? "bg-accent/15 text-accent"
                                : isExpensive
                                  ? "bg-red-500/15 text-red-400"
                                  : "text-muted"
                              : "text-muted"
                          }`}
                        >
                          {label}
                        </span>
                      )}
                    </div>
                    {signedIn && (
                      <button
                        type="button"
                        onClick={() => manualPick(c.id, c.title)}
                        disabled={pickLoading === c.id || !canPick}
                        className="rounded-full border border-edge px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted transition-colors hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {pickLoading === c.id ? "Picking…" : "Pick"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!signedIn && (
            <div className="mt-6 flex justify-center">
              <SignInPrompt
                message="Sign in to pick this week's movie."
                label="Sign in to pick"
                callbackUrl="/choose"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Winner modal ─────────────────────────────────── */}
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
