"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

export type UserView = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  createdAt: string;
};

export type CandidateView = {
  id: string;
  title: string;
  source: "WHATSAPP" | "MANUAL";
  createdAt: string;
  posterUrl: string | null;
  trailerUrl: string | null;
};

export type ScreeningView = {
  id: string;
  year: number;
  weekNumber: number;
  movieTitle: string;
  votes: number;
  posterUrl: string | null;
  trailerUrl: string | null;
};

export function DashboardClient({
  initialUsers,
  initialCandidates,
  initialScreenings,
}: {
  initialUsers: UserView[];
  initialCandidates: CandidateView[];
  initialScreenings: ScreeningView[];
}) {
  const router = useRouter();
  const [users] = useState<UserView[]>(initialUsers);
  const [candidates, setCandidates] = useState<CandidateView[]>(initialCandidates);
  const [screenings, setScreenings] = useState<ScreeningView[]>(initialScreenings);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    router.refresh();
  }, [router]);

  async function enrichItem(type: "candidate" | "screening", id: string) {
    setError(null);
    setLoading(`enrich-${id}`);
    const res = await fetch("/api/dashboard/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
    const data = await res.json();
    setLoading(null);

    if (!res.ok) {
      setError(data.error ?? "Failed to enrich metadata");
      return;
    }

    if (type === "candidate") {
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                posterUrl: data.metadata.posterUrl ?? c.posterUrl,
                trailerUrl: data.metadata.trailerUrl ?? c.trailerUrl,
              }
            : c,
        ),
      );
    } else {
      setScreenings((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                posterUrl: data.metadata.posterUrl ?? s.posterUrl,
                trailerUrl: data.metadata.trailerUrl ?? s.trailerUrl,
              }
            : s,
        ),
      );
    }
  }

  async function deleteCandidate(id: string) {
    if (!confirm("Remove this movie from the pool?")) return;
    setError(null);
    setLoading(`delete-${id}`);
    const res = await fetch(`/api/dashboard/pool/${id}`, { method: "DELETE" });
    setLoading(null);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to delete movie");
      return;
    }

    setCandidates((prev) => prev.filter((c) => c.id !== id));
  }

  async function addMovie(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) return;

    setLoading("add");
    const res = await fetch("/api/dashboard/pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    const data = await res.json();
    setLoading(null);

    if (!res.ok) {
      setError(data.error ?? "Could not add that movie");
      return;
    }

    setTitle("");
    refresh();
  }

  return (
    <div className="flex flex-col gap-12">
      {error && (
        <p className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent-2">
          {error}
        </p>
      )}

      {/* ── Users ─────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <p className="eyebrow">CURRENT USERS</p>
          <span className="rounded-full border border-edge px-2.5 py-0.5 text-[10px] font-mono text-muted">
            {users.length}
          </span>
        </div>

        {users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-edge bg-panel-2 p-14 text-center text-muted">
            <p className="font-display text-3xl italic">No users yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-edge">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge bg-panel text-[11px] uppercase tracking-[0.18em] text-muted">
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">ID</th>
                  <th className="px-4 py-3 text-left font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-edge last:border-0">
                    <td className="flex items-center gap-3 px-4 py-3">
                      {u.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.image}
                          alt={u.name ?? "User"}
                          width={28}
                          height={28}
                          className="rounded-full border border-edge"
                        />
                      ) : (
                        <span className="grid h-7 w-7 place-items-center rounded-full border border-accent/50 text-[10px] font-medium text-accent">
                          {(u.name ?? "?").slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="text-foreground">{u.name ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-muted">{u.email ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted">{u.id}</td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Pool Movies ───────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <p className="eyebrow">POOL MOVIES</p>
          <span className="rounded-full border border-edge px-2.5 py-0.5 text-[10px] font-mono text-muted">
            {candidates.length}
          </span>
        </div>

        <form onSubmit={addMovie} className="mb-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a movie by title…"
            maxLength={80}
            className="min-w-0 flex-1 rounded-lg border border-edge bg-background px-4 py-2.5 text-sm font-light outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 placeholder:text-bone-dim"
          />
          <button
            type="submit"
            disabled={loading === "add"}
            className="rounded-lg bg-accent px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.2em] text-background hover:bg-accent-2 transition-colors disabled:opacity-50"
          >
            {loading === "add" ? "Adding…" : "Add to pool"}
          </button>
        </form>

        {candidates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-edge bg-panel-2 p-14 text-center text-muted">
            <p className="font-display text-3xl italic">Dead reel</p>
            <p className="mt-2 text-sm">No movies in the pool.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {candidates.map((c) => (
              <li
                key={c.id}
                className="flex gap-4 rounded-xl border border-edge bg-panel p-4"
              >
                {c.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.posterUrl}
                    alt={`${c.title} poster`}
                    loading="lazy"
                    className="h-[128px] w-[85px] shrink-0 self-start rounded-md border border-edge object-cover"
                  />
                ) : (
                  <div className="h-[128px] w-[85px] shrink-0 self-start rounded-md border border-dashed border-edge bg-panel-2" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display truncate text-xl">{c.title}</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                        {c.source === "WHATSAPP" ? "via WhatsApp" : "manual"} ·{" "}
                        {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => enrichItem("candidate", c.id)}
                        disabled={loading === `enrich-${c.id}`}
                        className="rounded-md px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:bg-white/5 hover:text-accent disabled:opacity-50"
                        title="Fetch metadata from TMDB"
                      >
                        {loading === `enrich-${c.id}` ? "…" : "Enrich"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCandidate(c.id)}
                        disabled={loading === `delete-${c.id}`}
                        className="rounded-md px-2 py-1 text-sm text-muted transition-colors hover:bg-white/5 hover:text-accent disabled:opacity-50"
                        title="Remove from pool"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {c.trailerUrl && (
                    <a
                      href={c.trailerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-edge px-3 py-1 text-xs text-foreground transition-colors hover:border-accent/60 hover:text-accent"
                    >
                      ▶ Trailer
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Archived Movies ───────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <p className="eyebrow">ARCHIVED MOVIES</p>
          <span className="rounded-full border border-edge px-2.5 py-0.5 text-[10px] font-mono text-muted">
            {screenings.length}
          </span>
        </div>

        {screenings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-edge bg-panel-2 p-14 text-center text-muted">
            <p className="font-display text-3xl italic">Empty archive</p>
            <p className="mt-2 text-sm">No weekly picks yet.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {screenings.map((s) => (
              <li
                key={s.id}
                className="flex gap-4 rounded-xl border border-edge bg-panel p-4"
              >
                {s.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.posterUrl}
                    alt={`${s.movieTitle} poster`}
                    loading="lazy"
                    className="h-[128px] w-[85px] shrink-0 self-start rounded-md border border-edge object-cover"
                  />
                ) : (
                  <div className="h-[128px] w-[85px] shrink-0 self-start rounded-md border border-dashed border-edge bg-panel-2" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display truncate text-xl">{s.movieTitle}</p>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                        {s.year} · Week {s.weekNumber} · {s.votes} vote{s.votes === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => enrichItem("screening", s.id)}
                      disabled={loading === `enrich-${s.id}`}
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:bg-white/5 hover:text-accent disabled:opacity-50"
                      title="Fetch metadata from TMDB"
                    >
                      {loading === `enrich-${s.id}` ? "…" : "Enrich"}
                    </button>
                  </div>

                  {s.trailerUrl && (
                    <a
                      href={s.trailerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-edge px-3 py-1 text-xs text-foreground transition-colors hover:border-accent/60 hover:text-accent"
                    >
                      ▶ Trailer
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
